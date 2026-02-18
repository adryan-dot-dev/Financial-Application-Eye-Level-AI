import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Landmark, RefreshCw } from 'lucide-react'
import { obligoApi } from '@/api/obligo'
import type { ObligoSummary } from '@/types'
import { cn } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import { queryKeys } from '@/lib/queryKeys'

function getUtilizationColor(pct: number): string {
  if (pct >= 80) return 'var(--color-danger)'
  if (pct >= 60) return 'var(--color-warning)'
  return 'var(--color-income)'
}

function formatCompact(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '0'
  if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (Math.abs(num) >= 1_000) return `${Math.round(num / 1_000)}K`
  return num.toLocaleString()
}

function Skel({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />
}

function LoadingSkeleton() {
  return (
    <div className="card card-hover animate-fade-in-up overflow-hidden p-7">
      <div className="flex items-center gap-3 mb-6">
        <Skel className="h-10 w-10 rounded-xl" />
        <Skel className="h-4 w-36 rounded" />
      </div>
      <Skel className="h-6 w-full rounded-full mb-4" />
      <Skel className="h-4 w-48 rounded mb-5" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <Skel className="h-3 w-28 rounded" />
            <Skel className="h-3 w-20 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ObligoWidget() {
  const { t } = useTranslation()
  const { formatAmount } = useCurrency()

  const { data, isLoading, isError, refetch } = useQuery<ObligoSummary>({
    queryKey: queryKeys.obligo.summary(),
    queryFn: () => obligoApi.getSummary(),
  })

  if (isLoading) return <LoadingSkeleton />

  if (isError || !data) {
    return (
      <div className="card card-hover animate-fade-in-up flex flex-col items-center justify-center gap-3 p-12">
        <Landmark className="h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('obligo.loadError')}</p>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5 transition-colors"
          style={{ color: 'var(--color-brand-500)', backgroundColor: 'var(--bg-hover)' }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t('common.retry')}
        </button>
      </div>
    )
  }

  const total = parseFloat(data.total_obligo) || 0
  const loanPct = total > 0 ? (parseFloat(data.total_loan_outstanding) / total) * 100 : 0
  const creditPct = total > 0 ? (parseFloat(data.total_credit_utilization) / total) * 100 : 0
  const utilizationColor = getUtilizationColor(data.obligo_utilization_pct)
  const totalFramework = total + (parseFloat(data.total_available_credit) || 0)

  const rows = [
    { label: t('obligo.activeLoans'), value: data.total_loan_outstanding, color: 'var(--color-brand-500)' },
    { label: t('obligo.creditUtilization'), value: data.total_credit_utilization, color: 'var(--color-accent-teal)' },
    { label: t('obligo.totalFrameworks'), value: data.total_obligo, color: 'var(--text-primary)' },
    { label: t('obligo.available'), value: data.total_available_credit, color: 'var(--color-income)' },
  ]

  return (
    <div className="card card-hover animate-fade-in-up overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-7 py-5" style={{ borderColor: 'var(--border-primary)' }}>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: 'rgba(99, 102, 241, 0.08)', color: 'var(--color-brand-500)' }}
        >
          <Landmark className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t('obligo.title')}</h3>
      </div>

      <div className="p-7 space-y-5">
        {/* Stacked bar */}
        <div className="space-y-2">
          <div className="flex h-6 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--bg-hover)' }}>
            {loanPct > 0 && (
              <div
                className="h-full transition-all duration-700"
                style={{
                  width: `${loanPct}%`,
                  backgroundColor: 'var(--color-brand-500)',
                  borderRadius: creditPct === 0 ? '9999px' : '9999px 0 0 9999px',
                }}
                title={t('obligo.loans')}
              />
            )}
            {creditPct > 0 && (
              <div
                className="h-full transition-all duration-700"
                style={{ width: `${creditPct}%`, backgroundColor: 'var(--color-accent-teal)' }}
                title={t('obligo.creditUtilization')}
              />
            )}
          </div>
          {/* Summary line */}
          <div className="flex items-center gap-1.5 text-sm">
            <span className="font-bold ltr-nums" style={{ color: utilizationColor }}>
              ₪{formatCompact(total)}
            </span>
            <span style={{ color: 'var(--text-tertiary)' }}>/</span>
            <span className="font-medium ltr-nums" style={{ color: 'var(--text-secondary)' }}>
              ₪{formatCompact(totalFramework)}
            </span>
            <span
              className="ms-auto rounded-md px-2 py-0.5 text-xs font-bold"
              style={{ color: utilizationColor, backgroundColor: `color-mix(in srgb, ${utilizationColor} 12%, transparent)` }}
            >
              {data.obligo_utilization_pct}%
            </span>
          </div>
        </div>

        {/* Detail rows */}
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
              <span className="text-sm font-semibold ltr-nums" style={{ color: row.color }}>{formatAmount(row.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
