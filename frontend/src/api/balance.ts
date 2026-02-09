import type { BankBalance } from '@/types'
import apiClient from './client'

export interface CreateBalanceData {
  balance: number
  effective_date: string
  notes?: string
}

export interface UpdateBalanceData {
  balance: number
  effective_date: string
  notes?: string
}

export const balanceApi = {
  getCurrent: async (): Promise<BankBalance> => {
    const response = await apiClient.get<BankBalance>('/balance')
    return response.data
  },

  create: async (data: CreateBalanceData): Promise<BankBalance> => {
    const response = await apiClient.post<BankBalance>('/balance', data)
    return response.data
  },

  update: async (data: UpdateBalanceData): Promise<BankBalance> => {
    const response = await apiClient.put<BankBalance>('/balance', data)
    return response.data
  },

  history: async (): Promise<BankBalance[]> => {
    const response = await apiClient.get<BankBalance[]>('/balance/history')
    return response.data
  },
}
