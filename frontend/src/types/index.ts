// User types
export interface User {
  id: string
  username: string
  email: string
  full_name: string | null
  phone_number: string | null
  is_admin: boolean
  is_super_admin: boolean
  is_active: boolean
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
  alert_warning_threshold: string
  alert_critical_threshold: string
  onboarding_completed: boolean
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

// Payment method type
export type PaymentMethod = 'cash' | 'credit_card' | 'bank_transfer'

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
  payment_method?: PaymentMethod
  credit_card_id?: string | null
  bank_account_id?: string | null
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
  payment_method?: PaymentMethod
  credit_card_id?: string | null
  bank_account_id?: string | null
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
  payment_method?: PaymentMethod
  credit_card_id?: string | null
  bank_account_id?: string | null
  // Computed fields - auto-synced with current date
  status: 'pending' | 'active' | 'completed' | 'overdue'
  expected_payments_by_now: number
  is_on_track: boolean
  next_payment_date: string | null
  end_date: string | null
  remaining_amount: string
  progress_percentage: number
}

// Subscription
export interface Subscription {
  id: string
  name: string
  amount: string
  currency: string
  category_id: string | null
  billing_cycle: 'monthly' | 'quarterly' | 'semi_annual' | 'annual'
  next_renewal_date: string
  last_renewal_date: string | null
  auto_renew: boolean
  is_active: boolean
  paused_at: string | null
  resumed_at: string | null
  provider: string | null
  provider_url: string | null
  notes: string | null
  created_at: string | null
  updated_at: string | null
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
  bank_account_id?: string | null
}

// Forecast
export interface ForecastMonth {
  month: string
  opening_balance: string
  fixed_income: string
  fixed_expenses: string
  installment_income: string
  installment_expenses: string
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

// Expected Income
export interface ExpectedIncome {
  id: string
  user_id: string
  month: string
  expected_amount: string
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

export interface ExpectedIncomeListResponse {
  items: ExpectedIncome[]
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

// Organization types
export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer'

export interface Organization {
  id: string
  name: string
  slug: string
  is_active: boolean
  owner_id: string
  created_at: string
  updated_at: string
}

export interface OrgMember {
  id: string
  user_id: string
  username: string | null
  email: string | null
  role: OrgRole
  joined_at: string
  is_active: boolean
}

// Credit Cards
export interface CreditCard {
  id: string
  name: string
  last_four_digits: string
  card_network: 'visa' | 'mastercard' | 'amex' | 'isracard' | 'diners'
  issuer: string
  credit_limit: string
  billing_day: number
  currency: string
  is_active: boolean
  color: string
  notes?: string
  total_monthly_charges: string
  utilization_amount: string
  utilization_percentage: number
  available_credit: string
  linked_installments_count: number
  linked_subscriptions_count: number
  linked_fixed_count: number
  bank_account_id?: string | null
  linked_transactions_count?: number
}

export interface CreditCardCreate {
  name: string
  last_four_digits: string
  card_network: 'visa' | 'mastercard' | 'amex' | 'isracard' | 'diners'
  issuer: string
  credit_limit: number
  billing_day: number
  currency?: string
  color?: string
  notes?: string
  bank_account_id?: string
}

export type CreditCardUpdate = Partial<CreditCardCreate>

export interface CreditCardSummary {
  cards: CreditCard[]
  total_credit_limit: string
  total_utilization: string
  total_available: string
  average_utilization_pct: number
}

export interface CreditCardCharges {
  subscriptions: Array<{
    id: string
    name: string
    amount: string
    currency: string
    billing_cycle: string
  }>
  installments: Array<{
    id: string
    name: string
    monthly_amount: string
    currency: string
    payments_completed: number
    total_payments: number
  }>
  fixed: Array<{
    id: string
    name: string
    amount: string
    currency: string
  }>
  transactions: Array<{
    id: string
    name: string
    amount: string
    currency: string
  }>
}

export interface CreditCardNextBilling {
  billing_date: string
  total_charge: string
  remaining_after_charge: string
  card?: unknown
  charges?: Array<{
    source_type: string
    source_id: string
    name: string
    amount: string
    currency: string
    billing_cycle: string | null
  }>
}

// Bank Accounts
export interface BankAccount {
  id: string
  name: string
  bank_name: string
  account_last_digits?: string
  overdraft_limit: string
  currency: string
  is_primary: boolean
  notes?: string
  current_balance?: string
  available_balance?: string
  linked_loans_count?: number
}

export interface BankAccountCreate {
  name: string
  bank_name: string
  account_last_digits?: string
  overdraft_limit: number
  currency?: string
  is_primary?: boolean
  notes?: string
}

export type BankAccountUpdate = Partial<BankAccountCreate>

// Obligo
export interface ObligoSummary {
  total_credit_card_limits: string
  total_credit_utilization: string
  total_loan_outstanding: string
  total_overdraft_limits: string
  total_overdraft_used: string
  total_obligo: string
  total_available_credit: string
  obligo_utilization_pct: number
}

// Budgets
export interface Budget {
  id: string
  category_id: string
  category_name?: string
  category_name_he?: string
  category_color?: string
  category_icon?: string
  period_type: 'monthly' | 'quarterly' | 'annual'
  amount: string
  currency: string
  start_date: string
  is_active: boolean
  alert_at_percentage: number
  actual_amount: string
  remaining: string
  usage_percentage: number
  is_over_budget: boolean
}

export interface BudgetCreate {
  category_id: string
  period_type: 'monthly' | 'quarterly' | 'annual'
  amount: number
  currency?: string
  start_date: string
  alert_at_percentage?: number
}

export type BudgetUpdate = Partial<BudgetCreate>

export interface BudgetSummary {
  budgets: Budget[]
  total_budgeted: string
  total_actual: string
  total_remaining: string
  over_budget_count: number
}

// Expense Approvals
export interface ExpenseApproval {
  id: string
  requested_by: string
  requested_by_email?: string
  approved_by?: string
  status: 'pending' | 'approved' | 'rejected'
  amount: string
  currency: string
  description: string
  category_id?: string
  category_name?: string
  rejection_reason?: string
  requested_at: string
  resolved_at?: string
}

export interface ExpenseApprovalCreate {
  amount: number
  description: string
  category_id?: string
  currency?: string
}

// Organization Reports
export interface OrgReport {
  id: string
  report_type: 'monthly' | 'quarterly'
  period: string
  generated_at: string
  generated_by: string
  total_income: string
  total_expenses: string
  net: string
}

// Audit Log
export interface AuditLogEntry {
  id: string
  user_id: string
  user_email: string
  action: string
  entity_type: string
  entity_id?: string
  details?: string
  created_at: string
}

export interface AuditLogResponse {
  items: AuditLogEntry[]
  total: number
  page: number
  page_size: number
  pages: number
}
