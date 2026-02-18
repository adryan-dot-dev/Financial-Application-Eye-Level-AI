import { useMemo } from 'react'

interface UtilizationBarProps {
  /** Percentage value (0-100+, can exceed 100) */
  percentage: number
  /** Show the percentage label */
  showLabel?: boolean
  /** Show used/total amounts */
  used?: string
  total?: string
  /** Height variant */
  size?: 'sm' | 'md' | 'lg'
  /** Optional className */
  className?: string
}

function getBarColor(pct: number): string {
  if (pct >= 90) return 'var(--color-danger)'
  if (pct >= 80) return 'var(--color-warning-dark, var(--color-warning))'
  if (pct >= 50) return 'var(--color-warning)'
  return 'var(--color-success)'
}

function getBarBgColor(pct: number): string {
  if (pct >= 90) return 'var(--bg-danger)'
  if (pct >= 80) return 'var(--bg-warning)'
  if (pct >= 50) return 'var(--bg-warning)'
  return 'var(--bg-success)'
}

const SIZES = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
} as const

export default function UtilizationBar({
  percentage,
  showLabel = true,
  used,
  total,
  size = 'md',
  className = '',
}: UtilizationBarProps) {
  const clampedWidth = useMemo(() => Math.min(percentage, 100), [percentage])
  const isOverLimit = percentage > 100
  const barColor = useMemo(() => getBarColor(percentage), [percentage])
  const bgColor = useMemo(() => getBarBgColor(percentage), [percentage])

  return (
    <div className={className}>
      {/* Amount labels */}
      {used && total && (
        <div
          className="mb-1 flex items-center justify-between text-xs"
          style={{ color: 'var(--text-secondary)' }}
        >
          <span style={{ color: barColor, fontWeight: 600 }}>{used}</span>
          <span>{total}</span>
        </div>
      )}

      {/* Bar container */}
      <div
        className={`relative w-full overflow-hidden rounded-full ${SIZES[size]}`}
        style={{ backgroundColor: bgColor }}
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {/* Fill */}
        <div
          className={`absolute inset-y-0 start-0 rounded-full transition-all duration-500 ease-out ${
            isOverLimit ? 'animate-pulse' : ''
          }`}
          style={{
            width: `${clampedWidth}%`,
            backgroundColor: barColor,
          }}
        />
      </div>

      {/* Percentage label */}
      {showLabel && (
        <div className="mt-1 text-end">
          <span
            className="text-xs font-bold"
            style={{ color: barColor }}
          >
            {percentage.toFixed(percentage % 1 === 0 ? 0 : 1)}%
          </span>
        </div>
      )}
    </div>
  )
}
