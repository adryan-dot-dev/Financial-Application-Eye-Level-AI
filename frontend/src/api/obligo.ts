import type { ObligoSummary } from '@/types'
import apiClient from './client'

export const obligoApi = {
  getSummary: async (): Promise<ObligoSummary> => {
    const response = await apiClient.get<ObligoSummary>('/obligo')
    return response.data
  },
}
