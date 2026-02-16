import type { User } from '@/types'
import apiClient from './client'

export interface CreateUserRequest {
  username: string
  email: string
  password: string
  is_admin: boolean
}

export interface UpdateUserRequest {
  username?: string
  email?: string
  is_active?: boolean
  is_admin?: boolean
}

export const usersApi = {
  list: async (): Promise<User[]> => {
    const response = await apiClient.get('/users')
    const data = response.data
    // Defensive: handle both plain array and { items: [...] } response formats
    if (Array.isArray(data)) return data as User[]
    if (data && Array.isArray(data.items)) return data.items as User[]
    return []
  },

  create: async (data: CreateUserRequest): Promise<User> => {
    const response = await apiClient.post<User>('/users', data)
    return response.data
  },

  update: async (id: string, data: UpdateUserRequest): Promise<User> => {
    const response = await apiClient.put<User>(`/users/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/users/${id}`)
  },
}
