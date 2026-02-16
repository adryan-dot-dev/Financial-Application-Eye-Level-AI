import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Heart } from 'lucide-react'
import { dashboardApi } from '@/api/dashboard'
import type { FinancialHealthResponse, HealthFactor } from '@/api/dashboard'
import { cn } from '@/lib/utils'
import { queryKeys } from '@/lib/queryKeys'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FACTOR_COLORS: Record<string, string> = {
  savings_ratio: '#10B981',
  debt_ratio: '#3B82F6',
  balance_trend: '#3B82F6',
  expense_stability: '#F59E0B',
  emergency_fund: '#2563EB',
}

const FACTOR_TRANSLATION_KEYS: Record<string, string> = {
  savings_ratio: 'dashboard.savingsRatio',
  debt_ratio: 'dashboard.debtRatio',
  balance_trend: 'dashboard.balanceTrend',
  expense_stability: 'dashboard.expenseStability',
  emergency_fund: 'dashboard.emergencyFund',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getScoreColor(score: number): string {
  if (score >= 80) return '#10B981'
  if (score >= 60) return '#34D399'
  if (score >= 40) return '#FBBF24'
  if (score >= 20) return '#F97316'
  return '#EF4444'
}

function getGradeKey(grade: FinancialHealthResponse['grade']): string {
  const map: Record<FinancialHealthResponse['grade'], string> = {
    excellent: 'dashboard.healthExcellent',
    good: 'dashboard.healthGood',
    fair: 'dashboard.healthFair',
    poor: 'dashboard.healthPoor',
    critical: 'dashboard.healthCritical',
  }
  return map[grade]
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonBox({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={cn('skeleton', className)} style={style} />
}

// ---------------------------------------------------------------------------
// Gauge
// ---------------------------------------------------------------------------

function SemiCircularGauge({ score, grade, t }: { score: number; grade: FinancialHealthResponse['grade']; t: (key: string) => string }) {
  const color = getScoreColor(score)
  const radius = 80
  const strokeWidth = 12
  const cx = 100
  const cy = 90
  const arcLength = Math.PI * radius
  const progress = Math.max(0, Math.min(100, score))
  const dashOffset = arcLength - (arcLength * progress) / 100

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 110" className="w-full max-w-[220px]">
        {/* Background arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="var(--border-primary)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.8s ease-in-out, stroke 0.4s ease' }}
        />
      </svg>
      <div className="-mt-14 flex flex-col items-center">
        <span
          className="text-4xl font-extrabold ltr-nums"
          style={{ color }}
        >
          {score}
        </span>
        <span
          className="mt-1 text-sm font-semibold"
          style={{ color }}
        >
          {t(getGradeKey(grade))}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Factor Bar
// ---------------------------------------------------------------------------

function FactorBar({ factor, t }: { factor: HealthFactor; t: (key: string) => string }) {
  const color = FACTOR_COLORS[factor.name] ?? 'var(--text-secondary)'
  const translationKey = FACTOR_TRANSLATION_KEYS[factor.name]
  const label = translationKey ? t(translationKey) : factor.name

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </span>
        <span className="text-xs font-semibold ltr-nums" style={{ color: 'var(--text-primary)' }}>
          {factor.score}/100
        </span>
      </div>
      <div
        className="h-2 w-full rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--bg-hover)' }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(0, Math.min(100, factor.score))}%`,
            backgroundColor: color,
            transition: 'width 0.6s ease-in-out',
          }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// FinancialHealthWidget
// ---------------------------------------------------------------------------

export function FinancialHealthWidget() {
  const { t } = useTranslation()

  const { data, isLoading } = useQuery<FinancialHealthResponse>({
    queryKey: queryKeys.dashboard.financialHealth(),
    queryFn: () => dashboardApi.financialHealth(),
  })

  // --- Loading skeleton ---
  if (isLoading) {
    return (
      <div className="card card-hover animate-fade-in-up overflow-hidden p-7">
        <div className="flex items-center gap-3 mb-6">
          <SkeletonBox className="h-9 w-9 rounded-xl" />
          <SkeletonBox className="h-4 w-36 rounded" />
        </div>
        <div className="flex flex-col items-center mb-6">
          <SkeletonBox className="h-[110px] w-[220px] rounded-xl" />
          <SkeletonBox className="mt-3 h-8 w-16 rounded" />
          <SkeletonBox className="mt-2 h-4 w-20 rounded" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <SkeletonBox className="h-3 w-24 rounded" />
                <SkeletonBox className="h-3 w-12 rounded" />
              </div>
              <SkeletonBox className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // --- Empty state ---
  if (!data) {
    return (
      <div className="card card-hover animate-fade-in-up flex flex-col items-center justify-center p-12">
        <div
          className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ backgroundColor: 'var(--bg-hover)' }}
        >
          <Heart className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
          {t('common.noData')}
        </p>
      </div>
    )
  }

  return (
    <div className="card card-hover animate-fade-in-up overflow-hidden p-7">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            color: '#EF4444',
          }}
        >
          <Heart className="h-4.5 w-4.5" />
        </div>
        <h3
          className="text-base font-bold"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('dashboard.financialHealth')}
        </h3>
      </div>

      {/* Gauge */}
      <div className="mb-6">
        <SemiCircularGauge score={data.score} grade={data.grade} t={t} />
      </div>

      {/* Factor bars */}
      {data.factors.length > 0 && (
        <div className="space-y-3.5">
          {data.factors.map((factor) => (
            <FactorBar key={factor.name} factor={factor} t={t} />
          ))}
        </div>
      )}
    </div>
  )
}
