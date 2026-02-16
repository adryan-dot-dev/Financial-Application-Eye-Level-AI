import type { Alert, AlertListResponse } from '@/types'
import apiClient from './client'

export interface UnreadCountResponse {
  count: number
}

export interface MarkAllReadResponse {
  marked_count: number
}

export const alertsApi = {
  list: async (): Promise<AlertListResponse> => {
    const response = await apiClient.get('/alerts')
    const data = response.data
    // Defensive: handle both { items, unread_count } and plain array response formats
    if (data && Array.isArray(data.items)) {
      return data as AlertListResponse
    }
    if (Array.isArray(data)) {
      const items = data as Alert[]
      return {
        items,
        unread_count: items.filter((a) => !a.is_read).length,
      }
    }
    return { items: [], unread_count: 0 }
  },

  unread: async (): Promise<UnreadCountResponse> => {
    const response = await apiClient.get<UnreadCountResponse>('/alerts/unread')
    return response.data
  },

  markRead: async (id: string): Promise<void> => {
    await apiClient.put(`/alerts/${id}/read`)
  },

  markUnread: async (id: string): Promise<void> => {
    await apiClient.put(`/alerts/${id}/unread`)
  },

  markAllRead: async (): Promise<MarkAllReadResponse> => {
    const response = await apiClient.put<MarkAllReadResponse>('/alerts/read-all')
    return response.data
  },

  dismiss: async (id: string): Promise<void> => {
    await apiClient.put(`/alerts/${id}/dismiss`)
  },

  snooze: async (id: string, snoozedUntil: string): Promise<void> => {
    await apiClient.put(`/alerts/${id}/snooze`, { snooze_until: snoozedUntil })
  },
}
