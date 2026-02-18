import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { PeriodPreset, PeriodSelection } from '@/components/ui/PeriodSelector'
import { getDateRangeForPreset } from '@/components/ui/PeriodSelector'

const VALID_PRESETS: PeriodPreset[] = ['7D', '1M', '3M', '6M', '1Y', 'YTD', 'CUSTOM']
const DEFAULT_PRESET: PeriodPreset = '1M'

function isValidPreset(value: string | null): value is PeriodPreset {
  return value !== null && VALID_PRESETS.includes(value as PeriodPreset)
}

function isValidDate(value: string | null): boolean {
  if (!value) return false
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(new Date(value + 'T00:00:00').getTime())
}

export function usePeriodSelector(): {
  period: PeriodSelection
  setPeriod: (period: PeriodSelection) => void
} {
  const [searchParams, setSearchParams] = useSearchParams()

  const period = useMemo<PeriodSelection>(() => {
    const presetParam = searchParams.get('period')
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')

    if (isValidPreset(presetParam)) {
      if (presetParam === 'CUSTOM' && isValidDate(fromParam) && isValidDate(toParam)) {
        return {
          preset: 'CUSTOM',
          startDate: fromParam!,
          endDate: toParam!,
        }
      }

      if (presetParam !== 'CUSTOM') {
        const range = getDateRangeForPreset(presetParam)
        return { preset: presetParam, ...range }
      }
    }

    // Default to 1M
    const range = getDateRangeForPreset(DEFAULT_PRESET)
    return { preset: DEFAULT_PRESET, ...range }
  }, [searchParams])

  const setPeriod = useCallback(
    (newPeriod: PeriodSelection) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev)
          params.set('period', newPeriod.preset)

          if (newPeriod.preset === 'CUSTOM') {
            params.set('from', newPeriod.startDate)
            params.set('to', newPeriod.endDate)
          } else {
            params.delete('from')
            params.delete('to')
          }

          return params
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  return { period, setPeriod }
}
