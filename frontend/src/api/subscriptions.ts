import type { Subscription } from '@/types'
import apiClient from './client'

export interface SubscriptionListParams {
  status?: 'active' | 'paused'
  billing_cycle?: string
  sort_by?: string
  sort_order?: string
}

export interface CreateSubscriptionData {
  name: string
  amount: number
  currency?: string
  category_id?: string
  billing_cycle: string
  next_renewal_date: string
  last_renewal_date?: string
  auto_renew?: boolean
  provider?: string
  provider_url?: string
  notes?: string
  credit_card_id?: string
}

export type UpdateSubscriptionData = Partial<CreateSubscriptionData>

export const subscriptionsApi = {
  list: async (params?: SubscriptionListParams): Promise<Subscription[]> => {
    const response = await apiClient.get('/subscriptions', { params })
    const data = response.data
    if (Array.isArray(data)) return data as Subscription[]
    if (data && Array.isArray(data.items)) return data.items as Subscription[]
    return []
  },

  get: async (id: string): Promise<Subscription> => {
    const response = await apiClient.get<Subscription>(`/subscriptions/${id}`)
    return response.data
  },

  create: async (data: CreateSubscriptionData): Promise<Subscription> => {
    const response = await apiClient.post<Subscription>('/subscriptions', data)
    return response.data
  },

  update: async (id: string, data: UpdateSubscriptionData): Promise<Subscription> => {
    const response = await apiClient.put<Subscription>(`/subscriptions/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/subscriptions/${id}`)
  },

  pause: async (id: string): Promise<Subscription> => {
    const response = await apiClient.post<Subscription>(`/subscriptions/${id}/pause`)
    return response.data
  },

  resume: async (id: string): Promise<Subscription> => {
    const response = await apiClient.post<Subscription>(`/subscriptions/${id}/resume`)
    return response.data
  },

  upcoming: async (days = 30): Promise<Subscription[]> => {
    const response = await apiClient.get('/subscriptions/upcoming', { params: { days } })
    const data = response.data
    if (Array.isArray(data)) return data as Subscription[]
    if (data && Array.isArray(data.items)) return data.items as Subscription[]
    return []
  },
}
