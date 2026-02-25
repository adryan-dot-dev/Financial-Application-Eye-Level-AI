import axios from 'axios'
import type { AxiosError } from 'axios'
import i18n from '@/i18n/config'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - add JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ---------------------------------------------------------------------------
// Helper: translate HTTP error status to a user-friendly message
// ---------------------------------------------------------------------------

const STATUS_MESSAGE_KEYS: Record<number, string> = {
  400: 'apiError.400',
  401: 'apiError.401',
  403: 'apiError.403',
  404: 'apiError.404',
  409: 'apiError.409',
  422: 'apiError.422',
  500: 'apiError.500',
}

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ detail?: string | Array<{ msg: string }> }>

    // No response = network error
    if (!axiosError.response) {
      return i18n.t('toast.networkError')
    }

    const status = axiosError.response.status
    const detail = axiosError.response.data?.detail

    // 422 = Pydantic validation errors — extract the actual message
    if (status === 422 && Array.isArray(detail) && detail.length > 0) {
      const msg = detail[0].msg
      if (msg && typeof msg === 'string') {
        // Pydantic prefixes with "Value error, " — strip it
        return msg.replace(/^Value error,\s*/i, '')
      }
    }

    // Server returned a string detail (e.g. 409 "Username already exists")
    if (detail && typeof detail === 'string') {
      return detail
    }

    // Generic status-based message
    const messageKey = STATUS_MESSAGE_KEYS[status]
    if (messageKey) {
      return i18n.t(messageKey)
    }

    return i18n.t('toast.error')
  }

  // Non-axios error
  if (error instanceof Error) {
    return error.message
  }

  return i18n.t('toast.error')
}

// Response interceptor - handle 401 + token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Never intercept 401s from auth endpoints – let them propagate
    // so LoginPage / RegisterPage can show the error to the user.
    const isAuthEndpoint =
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/register') ||
      originalRequest.url?.includes('/auth/refresh')

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthEndpoint
    ) {
      originalRequest._retry = true

      try {
        const refreshToken = localStorage.getItem('refresh_token')
        if (!refreshToken) {
          // No refresh token, redirect to login
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.href = '/login'
          return Promise.reject(error)
        }

        const response = await axios.post('/api/v1/auth/refresh', {
          refresh_token: refreshToken,
        })

        const { access_token, refresh_token: new_refresh_token } = response.data
        localStorage.setItem('access_token', access_token)
        if (new_refresh_token) {
          localStorage.setItem('refresh_token', new_refresh_token)
        }
        originalRequest.headers.Authorization = `Bearer ${access_token}`
        return apiClient(originalRequest)
      } catch {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
        return Promise.reject(error)
      }
    }

    // 403 Forbidden — token is valid but user lacks permission; redirect to login
    if (error.response?.status === 403 && !isAuthEndpoint) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      window.location.href = '/login'
      return Promise.reject(error)
    }

    return Promise.reject(error)
  }
)

export default apiClient
