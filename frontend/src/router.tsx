import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import ErrorPage from '@/pages/ErrorPage'

// Lazy-loaded pages
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/RegisterPage'))
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const TransactionsPage = lazy(() => import('@/pages/TransactionsPage'))
const FixedPage = lazy(() => import('@/pages/FixedPage'))
const InstallmentsPage = lazy(() => import('@/pages/InstallmentsPage'))
const LoansPage = lazy(() => import('@/pages/LoansPage'))
const CategoriesPage = lazy(() => import('@/pages/CategoriesPage'))
const ForecastPage = lazy(() => import('@/pages/ForecastPage'))
const BalancePage = lazy(() => import('@/pages/BalancePage'))
const AlertsPage = lazy(() => import('@/pages/AlertsPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const UsersPage = lazy(() => import('@/pages/UsersPage'))

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: '/login',
    element: (
      <SuspenseWrapper>
        <LoginPage />
      </SuspenseWrapper>
    ),
  },
  {
    path: '/register',
    element: (
      <SuspenseWrapper>
        <RegisterPage />
      </SuspenseWrapper>
    ),
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/onboarding',
        element: (
          <SuspenseWrapper>
            <OnboardingPage />
          </SuspenseWrapper>
        ),
      },
      {
        element: <AppLayout />,
        children: [
          {
            path: '/dashboard',
            element: (
              <SuspenseWrapper>
                <DashboardPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: '/transactions',
            element: (
              <SuspenseWrapper>
                <TransactionsPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: '/fixed',
            element: (
              <SuspenseWrapper>
                <FixedPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: '/installments',
            element: (
              <SuspenseWrapper>
                <InstallmentsPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: '/loans',
            element: (
              <SuspenseWrapper>
                <LoansPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: '/categories',
            element: (
              <SuspenseWrapper>
                <CategoriesPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: '/forecast',
            element: (
              <SuspenseWrapper>
                <ForecastPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: '/balance',
            element: (
              <SuspenseWrapper>
                <BalancePage />
              </SuspenseWrapper>
            ),
          },
          {
            path: '/alerts',
            element: (
              <SuspenseWrapper>
                <AlertsPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: '/settings',
            element: (
              <SuspenseWrapper>
                <SettingsPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: '/users',
            element: (
              <SuspenseWrapper>
                <UsersPage />
              </SuspenseWrapper>
            ),
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <ErrorPage statusCode={404} />,
  },
])
