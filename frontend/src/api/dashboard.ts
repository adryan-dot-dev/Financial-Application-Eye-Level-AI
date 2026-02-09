import apiClient from './client'

export interface DashboardSummary {
  current_balance: string
  monthly_income: string
  monthly_expenses: string
  net_cashflow: string
  balance_trend: string
  income_trend: string
  expense_trend: string
}

export interface DashboardPeriodData {
  period: string
  income: string
  expenses: string
  net: string
  balance: string
}

export const dashboardApi = {
  summary: async (): Promise<DashboardSummary> => {
    const response = await apiClient.get<DashboardSummary>('/dashboard/summary')
    return response.data
  },

  weekly: async (): Promise<DashboardPeriodData[]> => {
    const response = await apiClient.get<DashboardPeriodData[]>('/dashboard/weekly')
    return response.data
  },

  monthly: async (): Promise<DashboardPeriodData[]> => {
    const response = await apiClient.get<DashboardPeriodData[]>('/dashboard/monthly')
    return response.data
  },

  quarterly: async (): Promise<DashboardPeriodData[]> => {
    const response = await apiClient.get<DashboardPeriodData[]>('/dashboard/quarterly')
    return response.data
  },
}
