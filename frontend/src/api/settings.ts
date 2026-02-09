import type { Settings } from '@/types'
import apiClient from './client'

export const settingsApi = {
  get: async (): Promise<Settings> => {
    const response = await apiClient.get<Settings>('/settings')
    return response.data
  },

  update: async (data: Partial<Settings>): Promise<Settings> => {
    const response = await apiClient.put<Settings>('/settings', data)
    return response.data
  },
}
