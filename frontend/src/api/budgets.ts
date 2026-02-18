import type { Budget, BudgetCreate, BudgetUpdate, BudgetSummary } from '@/types'
import apiClient from './client'

export const budgetsApi = {
  list: async (): Promise<Budget[]> => {
    const response = await apiClient.get('/budgets')
    const data = response.data
    if (Array.isArray(data)) return data as Budget[]
    if (data && Array.isArray(data.items)) return data.items as Budget[]
    return []
  },

  get: async (id: string): Promise<Budget> => {
    const response = await apiClient.get<Budget>(`/budgets/${id}`)
    return response.data
  },

  create: async (data: BudgetCreate): Promise<Budget> => {
    const response = await apiClient.post<Budget>('/budgets', data)
    return response.data
  },

  update: async (id: string, data: BudgetUpdate): Promise<Budget> => {
    const response = await apiClient.put<Budget>(`/budgets/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/budgets/${id}`)
  },

  getSummary: async (): Promise<BudgetSummary> => {
    const response = await apiClient.get<BudgetSummary>('/budgets/summary')
    return response.data
  },
}
