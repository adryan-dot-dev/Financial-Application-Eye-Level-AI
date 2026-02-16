import type { Category } from '@/types'
import apiClient from './client'

export interface CategoryListParams {
  type?: string
}

export interface CreateCategoryData {
  name: string
  name_he: string
  type: string
  icon?: string
  color?: string
}

export type UpdateCategoryData = Partial<CreateCategoryData>

export const categoriesApi = {
  list: async (params?: CategoryListParams): Promise<Category[]> => {
    const response = await apiClient.get('/categories', { params })
    const data = response.data
    // Defensive: handle both plain array and { items: [...] } response formats
    if (Array.isArray(data)) return data as Category[]
    if (data && Array.isArray(data.items)) return data.items as Category[]
    return []
  },

  get: async (id: string): Promise<Category> => {
    const response = await apiClient.get<Category>(`/categories/${id}`)
    return response.data
  },

  create: async (data: CreateCategoryData): Promise<Category> => {
    const response = await apiClient.post<Category>('/categories', data)
    return response.data
  },

  update: async (id: string, data: UpdateCategoryData): Promise<Category> => {
    const response = await apiClient.put<Category>(`/categories/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/categories/${id}`)
  },

  reorder: async (ids: string[]): Promise<void> => {
    await apiClient.post('/categories/reorder', { ids })
  },
}
