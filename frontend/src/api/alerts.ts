import type { AlertListResponse } from '@/types'
import apiClient from './client'

export interface UnreadCountResponse {
  count: number
}

export const alertsApi = {
  list: async (): Promise<AlertListResponse> => {
    const response = await apiClient.get<AlertListResponse>('/alerts')
    return response.data
  },

  unread: async (): Promise<UnreadCountResponse> => {
    const response = await apiClient.get<UnreadCountResponse>('/alerts/unread')
    return response.data
  },

  markRead: async (id: string): Promise<void> => {
    await apiClient.put(`/alerts/${id}/read`)
  },

  dismiss: async (id: string): Promise<void> => {
    await apiClient.put(`/alerts/${id}/dismiss`)
  },
}
