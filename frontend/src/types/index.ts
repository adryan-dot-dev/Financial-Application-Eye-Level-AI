// User types
export interface User {
  id: string
  username: string
  email: string
  is_admin: boolean
  created_at: string
  last_login_at: string | null
}

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface Settings {
  id: string
  currency: string
  language: string
  date_format: string
  theme: string
  notifications_enabled: boolean
  forecast_months_default: number
  week_start_day: number
}

// Category types
export interface Category {
  id: string
  name: string
  name_he: string
  type: 'income' | 'expense'
  icon: string
  color: string
  is_archived: boolean
  display_order: number
}

// Transaction types
export interface Transaction {
  id: string
  amount: string
  currency: string
  type: 'income' | 'expense'
  category_id: string | null
  description: string | null
  date: string
  entry_pattern: string
  is_recurring: boolean
  notes: string | null
  tags: string[] | null
}

export interface TransactionListResponse {
  items: Transaction[]
  total: number
  page: number
  page_size: number
  pages: number
}

// Fixed Income/Expense
export interface FixedEntry {
  id: string
  name: string
  amount: string
  currency: string
  type: 'income' | 'expense'
  category_id: string | null
  day_of_month: number
  start_date: string
  end_date: string | null
  is_active: boolean
  description: string | null
}

// Installment
export interface Installment {
  id: string
  name: string
  total_amount: string
  monthly_amount: string
  currency: string
  number_of_payments: number
  type: 'income' | 'expense'
  category_id: string | null
  start_date: string
  day_of_month: number
  payments_completed: number
  description: string | null
}

// Loan
export interface Loan {
  id: string
  name: string
  original_amount: string
  monthly_payment: string
  currency: string
  interest_rate: string
  category_id: string | null
  start_date: string
  day_of_month: number
  total_payments: number
  payments_made: number
  remaining_balance: string
  status: 'active' | 'completed' | 'paused'
  description: string | null
}

// Balance
export interface BankBalance {
  id: string
  balance: string
  effective_date: string
  is_current: boolean
  notes: string | null
}

// Forecast
export interface ForecastMonth {
  month: string
  opening_balance: string
  fixed_income: string
  fixed_expenses: string
  installment_payments: string
  loan_payments: string
  expected_income: string
  one_time_income: string
  one_time_expenses: string
  total_income: string
  total_expenses: string
  net_change: string
  closing_balance: string
}

export interface ForecastResponse {
  current_balance: string
  months: ForecastMonth[]
  has_negative_months: boolean
  first_negative_month: string | null
}

export interface ForecastSummary {
  current_balance: string
  forecast_months: number
  total_expected_income: string
  total_expected_expenses: string
  net_projected: string
  end_balance: string
  has_negative_months: boolean
  alerts_count: number
}

// Alert
export interface Alert {
  id: string
  alert_type: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string
  is_read: boolean
  is_dismissed: boolean
  created_at: string
}

export interface AlertListResponse {
  items: Alert[]
  unread_count: number
}
