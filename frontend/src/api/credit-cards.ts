import type { CreditCard, CreditCardCreate, CreditCardUpdate, CreditCardSummary, CreditCardCharges, CreditCardNextBilling } from '@/types'
import apiClient from './client'

export const creditCardsApi = {
  list: async (): Promise<CreditCard[]> => {
    const response = await apiClient.get('/credit-cards')
    const data = response.data
    if (Array.isArray(data)) return data as CreditCard[]
    if (data && Array.isArray(data.items)) return data.items as CreditCard[]
    return []
  },

  get: async (id: string): Promise<CreditCard> => {
    const response = await apiClient.get<CreditCard>(`/credit-cards/${id}`)
    return response.data
  },

  create: async (data: CreditCardCreate): Promise<CreditCard> => {
    const response = await apiClient.post<CreditCard>('/credit-cards', data)
    return response.data
  },

  update: async (id: string, data: CreditCardUpdate): Promise<CreditCard> => {
    const response = await apiClient.put<CreditCard>(`/credit-cards/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/credit-cards/${id}`)
  },

  getSummary: async (): Promise<CreditCardSummary> => {
    const response = await apiClient.get<CreditCardSummary>('/credit-cards/summary')
    return response.data
  },

  getCharges: async (id: string): Promise<CreditCardCharges> => {
    const response = await apiClient.get<CreditCardCharges>(`/credit-cards/${id}/charges`)
    return response.data
  },

  getNextBilling: async (id: string): Promise<CreditCardNextBilling> => {
    const response = await apiClient.get<CreditCardNextBilling>(`/credit-cards/${id}/next-billing`)
    return response.data
  },
}
