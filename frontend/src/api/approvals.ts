import type { ExpenseApproval, ExpenseApprovalCreate } from '@/types'
import apiClient from './client'

export const approvalsApi = {
  list: async (orgId: string, status?: 'pending' | 'approved' | 'rejected'): Promise<ExpenseApproval[]> => {
    const params: Record<string, string> = {}
    if (status) params.status = status
    const response = await apiClient.get(`/organizations/${orgId}/approvals`, { params })
    const data = response.data
    if (Array.isArray(data)) return data as ExpenseApproval[]
    if (data && Array.isArray(data.items)) return data.items as ExpenseApproval[]
    return []
  },

  getPending: async (orgId: string): Promise<ExpenseApproval[]> => {
    const response = await apiClient.get(`/organizations/${orgId}/approvals`, { params: { status: 'pending' } })
    const data = response.data
    if (Array.isArray(data)) return data as ExpenseApproval[]
    if (data && Array.isArray(data.items)) return data.items as ExpenseApproval[]
    return []
  },

  submit: async (orgId: string, data: ExpenseApprovalCreate): Promise<ExpenseApproval> => {
    const response = await apiClient.post<ExpenseApproval>(`/organizations/${orgId}/approvals`, data)
    return response.data
  },

  approve: async (orgId: string, id: string): Promise<ExpenseApproval> => {
    const response = await apiClient.post<ExpenseApproval>(`/organizations/${orgId}/approvals/${id}/approve`)
    return response.data
  },

  reject: async (orgId: string, id: string, reason: string): Promise<ExpenseApproval> => {
    const response = await apiClient.post<ExpenseApproval>(`/organizations/${orgId}/approvals/${id}/reject`, { reason })
    return response.data
  },
}
