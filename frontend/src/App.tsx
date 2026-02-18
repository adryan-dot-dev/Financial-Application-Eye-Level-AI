import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { queryClient } from '@/lib/queryClient'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { OrganizationProvider } from '@/contexts/OrganizationContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { ToastContainer } from '@/components/Toast'
import { router } from '@/router'
import ErrorBoundary from '@/components/ErrorBoundary'

export default function App() {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <OrganizationProvider>
                <ToastProvider>
                  <RouterProvider router={router} />
                  <ToastContainer />
                </ToastProvider>
              </OrganizationProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </MotionConfig>
    </ErrorBoundary>
  )
}
