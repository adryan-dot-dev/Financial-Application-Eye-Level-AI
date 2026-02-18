import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, DollarSign, Wallet, BarChart3 } from 'lucide-react'
import { useCurrency } from '@/hooks/useCurrency'
import { dashboardApi } from '@/api/dashboard'
import { queryKeys } from '@/lib/queryKeys'

interface OrgOverviewTabProps {
  orgId: string
}

export default function OrgOverviewTab({ orgId: _orgId }: OrgOverviewTabProps) {
  const { t } = useTranslation()
  const { formatAmount } = useCurrency()

  const { data: summary, isLoading } = useQuery({
    queryKey: queryKeys.dashboard.summary(),
    queryFn: () => dashboardApi.summary(),
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-5">
            <div className="skeleton-group space-y-3">
              <div className="skeleton h-4 w-24 rounded" />
              <div className="skeleton h-8 w-32 rounded" />
              <div className="skeleton h-3 w-16 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const kpis = [
    {
      label: t('dashboard.monthlyIncome'),
      value: summary ? formatAmount(parseFloat(summary.monthly_income)) : '—',
      icon: TrendingUp,
      color: 'var(--color-income)',
      bg: 'var(--bg-success)',
    },
    {
      label: t('dashboard.monthlyExpenses'),
      value: summary ? formatAmount(parseFloat(summary.monthly_expenses)) : '—',
      icon: TrendingDown,
      color: 'var(--color-expense)',
      bg: 'var(--bg-danger)',
    },
    {
      label: t('dashboard.netCashflow'),
      value: summary ? formatAmount(parseFloat(summary.net_cashflow)) : '—',
      icon: DollarSign,
      color: summary && parseFloat(summary.net_cashflow) >= 0 ? 'var(--color-income)' : 'var(--color-expense)',
      bg: summary && parseFloat(summary.net_cashflow) >= 0 ? 'var(--bg-success)' : 'var(--bg-danger)',
    },
    {
      label: t('dashboard.currentBalance'),
      value: summary ? formatAmount(parseFloat(summary.current_balance)) : '—',
      icon: Wallet,
      color: 'var(--color-brand-500)',
      bg: 'var(--bg-info)',
    },
  ]

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon
          return (
            <div
              key={i}
              className="card p-5 animate-fade-in-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {kpi.label}
                </span>
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ backgroundColor: kpi.bg }}
                >
                  <Icon className="h-4 w-4" style={{ color: kpi.color }} />
                </div>
              </div>
              <div
                className="text-2xl font-bold ltr-nums"
                style={{ color: 'var(--text-primary)' }}
              >
                {kpi.value}
              </div>
            </div>
          )
        })}
      </div>

      {/* Activity placeholder */}
      <div className="card p-6 text-center">
        <BarChart3 className="mx-auto h-12 w-12 mb-3 opacity-30" style={{ color: 'var(--text-tertiary)' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          {t('organizations.subtitle')}
        </p>
      </div>
    </div>
  )
}
