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
    const response = await apiClient.get<
      Array<{ source_type: string; source_id: string; name: string; amount: string; currency: string; billing_cycle: string | null }>
      | CreditCardCharges
    >(`/credit-cards/${id}/charges`)
    const data = response.data

    // If backend already returns grouped object, pass through
    if (data && !Array.isArray(data) && 'subscriptions' in data) {
      const grouped = data as CreditCardCharges
      return {
        subscriptions: grouped.subscriptions ?? [],
        installments: grouped.installments ?? [],
        fixed: grouped.fixed ?? [],
        transactions: grouped.transactions ?? [],
      }
    }

    // Backend returns flat list — transform to grouped structure
    const items = Array.isArray(data) ? data : []
    const subscriptions = items
      .filter((i) => i.source_type === 'subscription')
      .map((i) => ({
        id: i.source_id,
        name: i.name,
        amount: i.amount,
        currency: i.currency,
        billing_cycle: i.billing_cycle || 'monthly',
      }))
    const installments = items
      .filter((i) => i.source_type === 'installment')
      .map((i) => ({
        id: i.source_id,
        name: i.name,
        monthly_amount: i.amount,
        currency: i.currency,
        payments_completed: 0,
        total_payments: 0,
      }))
    const fixed = items
      .filter((i) => i.source_type === 'fixed')
      .map((i) => ({
        id: i.source_id,
        name: i.name,
        amount: i.amount,
        currency: i.currency,
      }))
    const transactions = items
      .filter((i) => i.source_type === 'transaction')
      .map((i) => ({
        id: i.source_id,
        name: i.name,
        amount: i.amount,
        currency: i.currency,
      }))

    return { subscriptions, installments, fixed, transactions }
  },

  getNextBilling: async (id: string): Promise<CreditCardNextBilling> => {
    const response = await apiClient.get<CreditCardNextBilling>(`/credit-cards/${id}/next-billing`)
    return response.data
  },
}
