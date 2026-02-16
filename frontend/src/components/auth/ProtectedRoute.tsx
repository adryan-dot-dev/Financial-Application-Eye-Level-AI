import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { settingsApi } from '@/api/settings'

export default function ProtectedRoute() {
  const { isLoading, isAuthenticated } = useAuth()
  const location = useLocation()
  const [onboardingChecked, setOnboardingChecked] = useState(false)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)

  useEffect(() => {
    if (!isAuthenticated || isLoading) return

    if (location.pathname === '/onboarding') {
      setOnboardingChecked(true)
      return
    }

    // Check if onboarding was just completed in this session
    const justCompleted = sessionStorage.getItem('onboarding_completed')
    if (justCompleted === 'true') {
      setNeedsOnboarding(false)
      setOnboardingChecked(true)
      return
    }

    settingsApi.get()
      .then((settings) => {
        setNeedsOnboarding(!settings.onboarding_completed)
        if (settings.onboarding_completed) {
          // Cache it for future navigations in this session
          sessionStorage.setItem('onboarding_completed', 'true')
        }
      })
      .catch(() => {
        setNeedsOnboarding(true)
      })
      .finally(() => {
        setOnboardingChecked(true)
      })
  }, [isAuthenticated, isLoading, location.pathname])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (location.pathname === '/onboarding') {
    return <Outlet />
  }

  if (!onboardingChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (needsOnboarding) {
    return <Navigate to="/onboarding" replace />
  }

  return <Outlet />
}
