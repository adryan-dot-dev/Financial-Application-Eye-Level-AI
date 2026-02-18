import type { OrgReport } from '@/types'
import apiClient from './client'

export const orgReportsApi = {
  list: async (orgId: string): Promise<OrgReport[]> => {
    const response = await apiClient.get(`/organizations/${orgId}/reports`)
    const data = response.data
    if (Array.isArray(data)) return data as OrgReport[]
    if (data && Array.isArray(data.items)) return data.items as OrgReport[]
    return []
  },

  get: async (orgId: string, id: string): Promise<OrgReport> => {
    const response = await apiClient.get<OrgReport>(`/organizations/${orgId}/reports/${id}`)
    return response.data
  },

  generate: async (orgId: string, reportType: 'monthly' | 'quarterly', period: string): Promise<OrgReport> => {
    const response = await apiClient.post<OrgReport>(`/organizations/${orgId}/reports`, { report_type: reportType, period })
    return response.data
  },
}
