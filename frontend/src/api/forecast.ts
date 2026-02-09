import type { ForecastResponse, ForecastSummary } from '@/types'
import apiClient from './client'

export interface WeeklyForecastWeek {
  week_start: string
  week_end: string
  opening_balance: string
  income: string
  expenses: string
  net_change: string
  closing_balance: string
}

export interface WeeklyForecastResponse {
  current_balance: string
  weeks: WeeklyForecastWeek[]
}

export const forecastApi = {
  monthly: async (months?: number): Promise<ForecastResponse> => {
    const response = await apiClient.get<ForecastResponse>('/forecast', {
      params: months !== undefined ? { months } : undefined,
    })
    return response.data
  },

  weekly: async (weeks?: number): Promise<WeeklyForecastResponse> => {
    const response = await apiClient.get<WeeklyForecastResponse>('/forecast/weekly', {
      params: weeks !== undefined ? { weeks } : undefined,
    })
    return response.data
  },

  summary: async (months?: number): Promise<ForecastSummary> => {
    const response = await apiClient.get<ForecastSummary>('/forecast/summary', {
      params: months !== undefined ? { months } : undefined,
    })
    return response.data
  },
}
