import { useState, useCallback } from 'react'
import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'

export default function AppLayout() {
  const { t, i18n } = useTranslation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isRtl = i18n.language === 'he'

  const handleMobileOpen = useCallback(() => {
    setMobileOpen(true)
  }, [])

  const handleMobileClose = useCallback(() => {
    setMobileOpen(false)
  }, [])

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen"
      style={{ backgroundColor: 'var(--bg-secondary)' }}
    >
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
      <main
        id="main-content"
        tabIndex={-1}
        className="min-h-[calc(100vh-3.5rem)] p-4 transition-[margin] duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] md:min-h-screen md:p-8 md:pt-6 md:ms-[var(--sidebar-width)] outline-none"
      >
        <div className="mx-auto max-w-7xl page-reveal">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
