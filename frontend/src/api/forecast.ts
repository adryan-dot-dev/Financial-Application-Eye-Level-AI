import type { ForecastResponse, ForecastSummary } from '@/types'
import apiClient from './client'

export interface WeeklyForecastWeek {
  week_start: string
  week_end: string
  income: string
  expenses: string
  net_change: string
  running_balance: string
}

export interface WeeklyForecastResponse {
  current_balance: string
  weeks: WeeklyForecastWeek[]
}

export const forecastApi = {
  monthly: async (months?: number): Promise<ForecastResponse> => {
    const response = await apiClient.get('/forecast', {
      params: months !== undefined ? { months } : undefined,
    })
    const data = response.data
    // Defensive: ensure months is always an array
    if (data && !Array.isArray(data.months)) {
      data.months = []
    }
    return data as ForecastResponse
  },

  weekly: async (weeks?: number): Promise<WeeklyForecastResponse> => {
    const response = await apiClient.get('/forecast/weekly', {
      params: weeks !== undefined ? { weeks } : undefined,
    })
    const data = response.data
    // Defensive: ensure weeks is always an array
    if (data && !Array.isArray(data.weeks)) {
      data.weeks = []
    }
    return data as WeeklyForecastResponse
  },

  summary: async (months?: number): Promise<ForecastSummary> => {
    const response = await apiClient.get<ForecastSummary>('/forecast/summary', {
      params: months !== undefined ? { months } : undefined,
    })
    return response.data
  },
}
