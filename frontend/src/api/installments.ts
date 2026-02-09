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
}

export type UpdateInstallmentData = Partial<CreateInstallmentData>

export interface InstallmentPayment {
  id: string
  installment_id: string
  payment_number: number
  amount: string
  due_date: string
  is_paid: boolean
  paid_date: string | null
}

export const installmentsApi = {
  list: async (): Promise<Installment[]> => {
    const response = await apiClient.get<Installment[]>('/installments')
    return response.data
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
    const response = await apiClient.get<InstallmentPayment[]>(`/installments/${id}/payments`)
    return response.data
  },
}
