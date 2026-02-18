import type { Organization, OrgMember, OrgRole } from '@/types'
import apiClient from './client'

export interface CreateOrganizationRequest {
  name: string
}

export interface UpdateOrganizationRequest {
  name?: string
}

export interface AddMemberRequest {
  user_id?: string
  email?: string
  role: OrgRole
}

export interface ChangeMemberRoleRequest {
  role: OrgRole
}

export interface SwitchOrganizationRequest {
  organization_id: string | null
}

export const organizationsApi = {
  list: async (): Promise<Organization[]> => {
    const response = await apiClient.get('/organizations')
    const data = response.data
    if (Array.isArray(data)) return data as Organization[]
    if (data && Array.isArray(data.items)) return data.items as Organization[]
    return []
  },

  get: async (id: string): Promise<Organization> => {
    const response = await apiClient.get<Organization>(`/organizations/${id}`)
    return response.data
  },

  create: async (data: CreateOrganizationRequest): Promise<Organization> => {
    const response = await apiClient.post<Organization>('/organizations', data)
    return response.data
  },

  update: async (id: string, data: UpdateOrganizationRequest): Promise<Organization> => {
    const response = await apiClient.put<Organization>(`/organizations/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/organizations/${id}`)
  },

  listMembers: async (orgId: string): Promise<OrgMember[]> => {
    const response = await apiClient.get(`/organizations/${orgId}/members`)
    const data = response.data
    if (Array.isArray(data)) return data as OrgMember[]
    if (data && Array.isArray(data.items)) return data.items as OrgMember[]
    return []
  },

  addMember: async (orgId: string, data: AddMemberRequest): Promise<OrgMember> => {
    const response = await apiClient.post<OrgMember>(`/organizations/${orgId}/members`, data)
    return response.data
  },

  changeMemberRole: async (orgId: string, userId: string, data: ChangeMemberRoleRequest): Promise<OrgMember> => {
    const response = await apiClient.put<OrgMember>(`/organizations/${orgId}/members/${userId}`, data)
    return response.data
  },

  removeMember: async (orgId: string, userId: string): Promise<void> => {
    await apiClient.delete(`/organizations/${orgId}/members/${userId}`)
  },

  switchOrg: async (orgId: string | null): Promise<{ message: string; current_organization_id: string | null }> => {
    const response = await apiClient.post('/organizations/switch', { organization_id: orgId })
    return response.data
  },
}
