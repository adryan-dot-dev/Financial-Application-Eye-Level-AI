import type { ExpectedIncome, ExpectedIncomeListResponse } from '@/types'
import apiClient from './client'

export interface SetExpectedIncomeData {
  expected_amount: number
  notes?: string
}

export const expectedIncomeApi = {
  list: async (): Promise<ExpectedIncomeListResponse> => {
    const response = await apiClient.get('/expected-income')
    const data = response.data
    // Defensive: handle both { items: [...] } and plain array response formats
    if (data && Array.isArray(data.items)) {
      return data as ExpectedIncomeListResponse
    }
    if (Array.isArray(data)) {
      return { items: data as ExpectedIncome[] }
    }
    return { items: [] }
  },

  set: async (month: string, data: SetExpectedIncomeData): Promise<ExpectedIncome> => {
    const response = await apiClient.put<ExpectedIncome>(`/expected-income/${month}`, data)
    return response.data
  },

  remove: async (month: string): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(`/expected-income/${month}`)
    return response.data
  },
}
