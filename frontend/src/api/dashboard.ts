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

export interface CategoryBreakdownItem {
  category_id: string | null
  category_name: string
  category_name_he: string
  category_color: string
  category_icon: string
  total_amount: string
  percentage: string
  transaction_count: number
}

export interface CategoryBreakdownResponse {
  items: CategoryBreakdownItem[]
  total_expenses: string
  period: string
}

export interface UpcomingPaymentItem {
  id: string
  name: string
  amount: string
  currency: string
  source_type: 'fixed' | 'installment' | 'loan'
  type: 'income' | 'expense'
  due_date: string
  days_until_due: number
  category_name: string | null
  category_color: string | null
  installment_info: string | null
}

export interface UpcomingPaymentsResponse {
  items: UpcomingPaymentItem[]
  total_upcoming_expenses: string
  total_upcoming_income: string
  days_ahead: number
}

// --- Financial Health ---

export interface HealthFactor {
  name: string
  score: number
  weight: string
  description: string
}

export interface FinancialHealthResponse {
  score: number
  grade: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
  factors: HealthFactor[]
}

// --- Installments Summary ---

export interface InstallmentSummaryItem {
  id: string
  name: string
  monthly_amount: string
  currency: string
  type: 'income' | 'expense'
  payments_completed: number
  total_payments: number
  progress_pct: string
  remaining_amount: string
  next_payment_date: string | null
}

export interface InstallmentsSummaryResponse {
  active_count: number
  total_monthly_expense: string
  total_monthly_income: string
  total_remaining: string
  items: InstallmentSummaryItem[]
}

// --- Loans Summary ---

export interface LoanSummaryItem {
  id: string
  name: string
  monthly_payment: string
  currency: string
  original_amount: string
  remaining_balance: string
  payments_made: number
  total_payments: number
  progress_pct: string
  interest_rate: string
  next_payment_date: string | null
}

export interface LoansSummaryResponse {
  active_count: number
  total_monthly_payments: string
  total_remaining_balance: string
  total_original_amount: string
  overall_progress_pct: string
  items: LoanSummaryItem[]
}

// --- Top Expenses ---

export interface TopExpenseItem {
  id: string
  description: string
  amount: string
  currency: string
  date: string
  category_name: string | null
  category_name_he: string | null
  category_color: string | null
  category_icon: string | null
}

export interface TopExpensesResponse {
  items: TopExpenseItem[]
  period: string
}

export const dashboardApi = {
  summary: async (): Promise<DashboardSummary> => {
    const response = await apiClient.get<DashboardSummary>('/dashboard/summary')
    return response.data
  },

  weekly: async (): Promise<DashboardPeriodData[]> => {
    const response = await apiClient.get('/dashboard/weekly')
    const data = response.data
    // Defensive: handle both plain array and { items: [...] } response formats
    if (Array.isArray(data)) return data as DashboardPeriodData[]
    if (data && Array.isArray(data.items)) return data.items as DashboardPeriodData[]
    return []
  },

  monthly: async (): Promise<DashboardPeriodData[]> => {
    const response = await apiClient.get('/dashboard/monthly')
    const data = response.data
    // Defensive: handle both plain array and { items: [...] } response formats
    if (Array.isArray(data)) return data as DashboardPeriodData[]
    if (data && Array.isArray(data.items)) return data.items as DashboardPeriodData[]
    return []
  },

  quarterly: async (): Promise<DashboardPeriodData[]> => {
    const response = await apiClient.get('/dashboard/quarterly')
    const data = response.data
    // Defensive: handle both plain array and { items: [...] } response formats
    if (Array.isArray(data)) return data as DashboardPeriodData[]
    if (data && Array.isArray(data.items)) return data.items as DashboardPeriodData[]
    return []
  },

  categoryBreakdown: async (): Promise<CategoryBreakdownResponse> => {
    const response = await apiClient.get<CategoryBreakdownResponse>('/dashboard/category-breakdown')
    return response.data
  },

  upcomingPayments: async (days = 30): Promise<UpcomingPaymentsResponse> => {
    const response = await apiClient.get<UpcomingPaymentsResponse>('/dashboard/upcoming-payments', { params: { days } })
    return response.data
  },

  financialHealth: async (): Promise<FinancialHealthResponse> => {
    const response = await apiClient.get<FinancialHealthResponse>('/dashboard/financial-health')
    return response.data
  },

  installmentsSummary: async (): Promise<InstallmentsSummaryResponse> => {
    const response = await apiClient.get<InstallmentsSummaryResponse>('/dashboard/installments-summary')
    return response.data
  },

  loansSummary: async (): Promise<LoansSummaryResponse> => {
    const response = await apiClient.get<LoansSummaryResponse>('/dashboard/loans-summary')
    return response.data
  },

  topExpenses: async (): Promise<TopExpensesResponse> => {
    const response = await apiClient.get<TopExpensesResponse>('/dashboard/top-expenses')
    return response.data
  },
}
