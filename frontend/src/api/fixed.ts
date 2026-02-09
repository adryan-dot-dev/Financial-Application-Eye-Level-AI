import type { FixedEntry } from '@/types'
import apiClient from './client'

export interface FixedListParams {
  type?: string
}

export interface CreateFixedData {
  name: string
  amount: number
  type: string
  category_id?: string
  day_of_month: number
  start_date: string
  end_date?: string
  description?: string
}

export type UpdateFixedData = Partial<CreateFixedData>

export const fixedApi = {
  list: async (params?: FixedListParams): Promise<FixedEntry[]> => {
    const response = await apiClient.get<FixedEntry[]>('/fixed', { params })
    return response.data
  },

  get: async (id: string): Promise<FixedEntry> => {
    const response = await apiClient.get<FixedEntry>(`/fixed/${id}`)
    return response.data
  },

  create: async (data: CreateFixedData): Promise<FixedEntry> => {
    const response = await apiClient.post<FixedEntry>('/fixed', data)
    return response.data
  },

  update: async (id: string, data: UpdateFixedData): Promise<FixedEntry> => {
    const response = await apiClient.put<FixedEntry>(`/fixed/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/fixed/${id}`)
  },

  pause: async (id: string): Promise<FixedEntry> => {
    const response = await apiClient.post<FixedEntry>(`/fixed/${id}/pause`)
    return response.data
  },

  resume: async (id: string): Promise<FixedEntry> => {
    const response = await apiClient.post<FixedEntry>(`/fixed/${id}/resume`)
    return response.data
  },
}
