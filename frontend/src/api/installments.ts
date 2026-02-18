import type { Installment } from '@/types'
import apiClient from './client'

export interface CreateInstallmentData {
  name: string
  total_amount: number
  number_of_payments: number
  type: string
  category_id?: string
  start_date: string
  day_of_month: number
  description?: string
  currency?: string
  first_payment_made?: boolean
}

export type UpdateInstallmentData = Partial<CreateInstallmentData>

export interface InstallmentPayment {
  payment_number: number
  date: string
  amount: string
  status: 'completed' | 'upcoming' | 'future'
}

export const installmentsApi = {
  list: async (): Promise<Installment[]> => {
    const response = await apiClient.get('/installments')
    const data = response.data
    // Defensive: handle both plain array and { items: [...] } response formats
    if (Array.isArray(data)) return data as Installment[]
    if (data && Array.isArray(data.items)) return data.items as Installment[]
    return []
  },

  get: async (id: string): Promise<Installment> => {
    const response = await apiClient.get<Installment>(`/installments/${id}`)
    return response.data
  },

  create: async (data: CreateInstallmentData): Promise<Installment> => {
    const response = await apiClient.post<Installment>('/installments', data)
    return response.data
  },

  update: async (id: string, data: UpdateInstallmentData): Promise<Installment> => {
    const response = await apiClient.put<Installment>(`/installments/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/installments/${id}`)
  },

  payments: async (id: string): Promise<InstallmentPayment[]> => {
    const response = await apiClient.get(`/installments/${id}/payments`)
    const data = response.data
    // Defensive: handle both plain array and { items: [...] } response formats
    if (Array.isArray(data)) return data as InstallmentPayment[]
    if (data && Array.isArray(data.items)) return data.items as InstallmentPayment[]
    return []
  },

  markPaid: async (id: string): Promise<Installment> => {
    const response = await apiClient.post<Installment>(`/installments/${id}/mark-paid`)
    return response.data
  },
}
