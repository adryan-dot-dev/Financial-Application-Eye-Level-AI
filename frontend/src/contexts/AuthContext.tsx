import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { LoginRequest, RegisterRequest, User } from '@/types'
import { authApi } from '@/api/auth'
import { queryClient } from '@/lib/queryClient'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (data: LoginRequest) => Promise<void>
  register: (data: RegisterRequest) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const isAuthenticated = user !== null

  // On mount, check for existing token and validate it
  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      setIsLoading(false)
      return
    }

    authApi
      .getMe()
      .then((userData) => {
        setUser(userData)
      })
      .catch(() => {
        // Token is invalid or expired, clear storage
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        setUser(null)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const login = useCallback(async (data: LoginRequest) => {
    // Clear cached onboarding flag so ProtectedRoute re-checks from the API
    sessionStorage.removeItem('onboarding_completed')
    // Clear any previous user's cached data BEFORE setting new tokens.
    // Without this, React Query's 5-minute staleTime would serve the previous user's
    // cached data to the new user, causing data confusion across user switches.
    queryClient.clear()
    const response = await authApi.login(data)
    localStorage.setItem('access_token', response.access_token)
    localStorage.setItem('refresh_token', response.refresh_token)
    const userData = await authApi.getMe()
    setUser(userData)
  }, [])

  const register = useCallback(async (data: RegisterRequest) => {
    // Clear cached onboarding flag so the new user goes through onboarding
    sessionStorage.removeItem('onboarding_completed')
    // Same as login: clear previous user's cached data before setting new tokens.
    queryClient.clear()
    const response = await authApi.register(data)
    localStorage.setItem('access_token', response.access_token)
    localStorage.setItem('refresh_token', response.refresh_token)
    const userData = await authApi.getMe()
    setUser(userData)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    sessionStorage.removeItem('onboarding_completed')
    setUser(null)
    queryClient.clear()
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
