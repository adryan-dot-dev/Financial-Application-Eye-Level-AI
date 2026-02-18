import apiClient from './client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BackupResponse {
  id: string
  backup_type: string
  filename: string
  file_size: number | null
  file_path: string
  status: string
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  duration_seconds: number | null
  created_by: string | null
  verification_checksum: string | null
  is_verified: boolean
  created_at: string | null
}

export interface BackupListResponse {
  items: BackupResponse[]
  count: number
}

export interface BackupScheduleResponse {
  backup_dir: string
  retention_days: number
  last_backup: BackupResponse | null
  total_backups: number
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const backupsApi = {
  list: async (limit = 30, offset = 0): Promise<BackupListResponse> => {
    const response = await apiClient.get<BackupListResponse>('/backups', {
      params: { limit, offset },
    })
    return response.data
  },

  create: async (): Promise<BackupResponse> => {
    const response = await apiClient.post<BackupResponse>('/backups')
    return response.data
  },

  get: async (id: string): Promise<BackupResponse> => {
    const response = await apiClient.get<BackupResponse>(`/backups/${id}`)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/backups/${id}`)
  },

  verify: async (id: string): Promise<BackupResponse> => {
    const response = await apiClient.post<BackupResponse>(`/backups/${id}/verify`)
    return response.data
  },

  schedule: async (): Promise<BackupScheduleResponse> => {
    const response = await apiClient.get<BackupScheduleResponse>('/backups/schedule')
    return response.data
  },
}
