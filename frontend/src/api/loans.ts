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
  principal: string
  interest: string
  total_payment: string
  remaining_balance: string
}

export const loansApi = {
  list: async (): Promise<Loan[]> => {
    const response = await apiClient.get<Loan[]>('/loans')
    return response.data
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
    const response = await apiClient.get<LoanBreakdownEntry[]>(`/loans/${id}/breakdown`)
    return response.data
  },
}
