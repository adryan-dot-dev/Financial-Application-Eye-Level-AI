export const queryKeys = {
  transactions: {
    all: ['transactions'] as const,
    list: (params?: Record<string, unknown>) => ['transactions', 'list', params] as const,
    detail: (id: string) => ['transactions', 'detail', id] as const,
  },
  categories: {
    all: ['categories'] as const,
    list: (params?: Record<string, unknown>) => ['categories', 'list', params] as const,
  },
  fixed: {
    all: ['fixed'] as const,
    list: (params?: Record<string, unknown>) => ['fixed', 'list', params] as const,
  },
  installments: {
    all: ['installments'] as const,
    list: () => ['installments', 'list'] as const,
    payments: (id: string) => ['installments', 'payments', id] as const,
  },
  loans: {
    all: ['loans'] as const,
    list: () => ['loans', 'list'] as const,
    breakdown: (id: string) => ['loans', 'breakdown', id] as const,
  },
  balance: {
    all: ['balance'] as const,
    current: () => ['balance', 'current'] as const,
    history: () => ['balance', 'history'] as const,
  },
  forecast: {
    all: ['forecast'] as const,
    monthly: (months?: number) => ['forecast', 'monthly', months] as const,
    weekly: (weeks?: number) => ['forecast', 'weekly', weeks] as const,
    summary: (months?: number) => ['forecast', 'summary', months] as const,
  },
  alerts: {
    all: ['alerts'] as const,
    list: () => ['alerts', 'list'] as const,
    unread: () => ['alerts', 'unread'] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
    summary: () => ['dashboard', 'summary'] as const,
    categoryBreakdown: () => ['dashboard', 'category-breakdown'] as const,
    upcomingPayments: (days?: number) => ['dashboard', 'upcoming-payments', days] as const,
    financialHealth: () => ['dashboard', 'financial-health'] as const,
    installmentsSummary: () => ['dashboard', 'installments-summary'] as const,
    loansSummary: () => ['dashboard', 'loans-summary'] as const,
    topExpenses: () => ['dashboard', 'top-expenses'] as const,
  },
  settings: {
    all: ['settings'] as const,
  },
  users: {
    all: ['users'] as const,
    list: () => ['users', 'list'] as const,
  },
}
