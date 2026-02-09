import { useState, useCallback } from 'react'
import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'

export default function AppLayout() {
  const { i18n } = useTranslation()
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
      <Sidebar mobileOpen={mobileOpen} onMobileClose={handleMobileClose} />
      <Header onMenuClick={handleMobileOpen} />

      {/*
        Main content area.
        On mobile: no sidebar margin (sidebar is overlay).
        On md+: offset by sidebar width via CSS class.
        We use margin-inline-start which is RTL-aware: it maps to
        margin-right in RTL and margin-left in LTR when dir is set.
      */}
      <main className="min-h-[calc(100vh-3.5rem)] p-4 transition-[margin] duration-300 md:min-h-screen md:p-6 md:ms-[var(--sidebar-width)]">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
