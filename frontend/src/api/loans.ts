import type { Loan } from '@/types'
import apiClient from './client'

export interface CreateLoanData {
  name: string
  original_amount: number
  monthly_payment: number
  interest_rate: number
  category_id?: string
  start_date: string
  day_of_month: number
  total_payments: number
  description?: string
}

export type UpdateLoanData = Partial<CreateLoanData>

export interface LoanPaymentData {
  amount: number
}

export interface LoanBreakdownEntry {
  payment_number: number
  date: string
  payment_amount: string
  principal: string
  interest: string
  remaining_balance: string
  status: 'paid' | 'upcoming' | 'future'
}

export const loansApi = {
  list: async (): Promise<Loan[]> => {
    const response = await apiClient.get('/loans')
    const data = response.data
    // Defensive: handle both plain array and { items: [...] } response formats
    if (Array.isArray(data)) return data as Loan[]
    if (data && Array.isArray(data.items)) return data.items as Loan[]
    return []
  },

  get: async (id: string): Promise<Loan> => {
    const response = await apiClient.get<Loan>(`/loans/${id}`)
    return response.data
  },

  create: async (data: CreateLoanData): Promise<Loan> => {
    const response = await apiClient.post<Loan>('/loans', data)
    return response.data
  },

  update: async (id: string, data: UpdateLoanData): Promise<Loan> => {
    const response = await apiClient.put<Loan>(`/loans/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/loans/${id}`)
  },

  recordPayment: async (id: string, data: LoanPaymentData): Promise<Loan> => {
    const response = await apiClient.post<Loan>(`/loans/${id}/payment`, data)
    return response.data
  },

  breakdown: async (id: string): Promise<LoanBreakdownEntry[]> => {
    const response = await apiClient.get(`/loans/${id}/breakdown`)
    const data = response.data
    // Defensive: handle both plain array and { items: [...] } response formats
    if (Array.isArray(data)) return data as LoanBreakdownEntry[]
    if (data && Array.isArray(data.items)) return data.items as LoanBreakdownEntry[]
    return []
  },
}
