import type { Transaction, TransactionListResponse } from '@/types'
import apiClient from './client'

export interface TransactionListParams {
  page?: number
  page_size?: number
  type?: string
  category_id?: string
  start_date?: string
  end_date?: string
  min_amount?: number
  max_amount?: number
  search?: string
  sort_by?: string
  sort_order?: string
}

export interface CreateTransactionData {
  amount: number
  type: string
  date: string
  description?: string
  category_id?: string
  notes?: string
  tags?: string[]
  entry_pattern?: string
  currency?: string
  credit_card_id?: string
  payment_method?: string
  bank_account_id?: string
}

export type UpdateTransactionData = Partial<CreateTransactionData>

export const transactionsApi = {
  list: async (params?: TransactionListParams): Promise<TransactionListResponse> => {
    const response = await apiClient.get('/transactions', { params })
    const data = response.data
    // Defensive: ensure items is always an array even if response shape changes
    if (data && Array.isArray(data.items)) {
      return data as TransactionListResponse
    }
    // Fallback: if somehow a plain array is returned, wrap it
    if (Array.isArray(data)) {
      return { items: data as Transaction[], total: data.length, page: 1, page_size: data.length, pages: 1 }
    }
    return { items: [], total: 0, page: 1, page_size: 20, pages: 0 }
  },

  get: async (id: string): Promise<Transaction> => {
    const response = await apiClient.get<Transaction>(`/transactions/${id}`)
    return response.data
  },

  create: async (data: CreateTransactionData): Promise<Transaction> => {
    const response = await apiClient.post<Transaction>('/transactions', data)
    return response.data
  },

  update: async (id: string, data: UpdateTransactionData): Promise<Transaction> => {
    const response = await apiClient.put<Transaction>(`/transactions/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/transactions/${id}`)
  },

  duplicate: async (id: string): Promise<Transaction> => {
    const response = await apiClient.post<Transaction>(`/transactions/${id}/duplicate`)
    return response.data
  },

  bulkDelete: async (ids: string[]): Promise<void> => {
    await apiClient.post('/transactions/bulk-delete', { ids })
  },

  bulkUpdateCategory: async (ids: string[], category_id: string): Promise<void> => {
    await apiClient.put('/transactions/bulk-update', { ids, category_id })
  },
}
