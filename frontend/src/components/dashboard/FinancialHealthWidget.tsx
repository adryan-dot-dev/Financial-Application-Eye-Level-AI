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

function RingGauge({ score, grade, t }: { score: number; grade: FinancialHealthResponse['grade']; t: (key: string) => string }) {
  const color = getScoreColor(score)
  const size = 160
  const strokeWidth = 14
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = Math.max(0, Math.min(100, score))
  const dashOffset = circumference - (circumference * progress) / 100

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-primary)"
          strokeWidth={strokeWidth}
          strokeOpacity={0.3}
        />
        {/* Colored progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            transition: 'stroke-dashoffset 1s ease-in-out, stroke 0.4s ease',
            filter: `drop-shadow(0 0 6px ${color}40)`,
          }}
        />
      </svg>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-4xl font-extrabold ltr-nums"
          style={{ color }}
        >
          {score}
        </span>
        <span
          className="mt-0.5 text-xs font-semibold"
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
    <div className="card card-hover animate-fade-in-up overflow-hidden">
      {/* Widget header bar */}
      <div
        className="flex items-center gap-3 border-b px-7 py-5"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(239, 68, 68, 0.04))',
            color: '#EF4444',
          }}
        >
          <Heart className="h-5 w-5" />
        </div>
        <h3
          className="text-sm font-bold"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('dashboard.financialHealth')}
        </h3>
      </div>

      {/* Content: Ring gauge + factor bars side by side */}
      <div className="flex flex-col items-center gap-8 p-7 sm:flex-row sm:items-start">
        {/* Ring gauge */}
        <div className="shrink-0">
          <RingGauge score={data.score} grade={data.grade} t={t} />
        </div>

        {/* Factor bars - fills remaining space */}
        {data.factors.length > 0 && (
          <div className="w-full flex-1 space-y-4">
            {data.factors.map((factor) => (
              <FactorBar key={factor.name} factor={factor} t={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
