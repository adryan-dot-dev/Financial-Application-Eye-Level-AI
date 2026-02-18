import type { BankAccount, BankAccountCreate, BankAccountUpdate } from '@/types'
import apiClient from './client'

export const bankAccountsApi = {
  list: async (): Promise<BankAccount[]> => {
    const response = await apiClient.get('/bank-accounts')
    const data = response.data
    if (Array.isArray(data)) return data as BankAccount[]
    if (data && Array.isArray(data.items)) return data.items as BankAccount[]
    return []
  },

  get: async (id: string): Promise<BankAccount> => {
    const response = await apiClient.get<BankAccount>(`/bank-accounts/${id}`)
    return response.data
  },

  create: async (data: BankAccountCreate): Promise<BankAccount> => {
    const response = await apiClient.post<BankAccount>('/bank-accounts', data)
    return response.data
  },

  update: async (id: string, data: BankAccountUpdate): Promise<BankAccount> => {
    const response = await apiClient.put<BankAccount>(`/bank-accounts/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/bank-accounts/${id}`)
  },
}
