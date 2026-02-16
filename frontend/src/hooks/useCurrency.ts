import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Settings } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { queryKeys } from '@/lib/queryKeys'

/**
 * Hook that reads the user's preferred currency from the settings cache
 * and provides a `formatAmount` helper that automatically applies it.
 *
 * Usage:
 *   const { currency, formatAmount } = useCurrency()
 *   formatAmount(1234.56)            // uses settings currency
 *   formatAmount(1234.56, 'USD')     // override with explicit currency
 */
export function useCurrency() {
  const queryClient = useQueryClient()

  // Read settings directly from the React Query cache (synchronous)
  const settings = queryClient.getQueryData<Settings>(queryKeys.settings.all)
  const currency = settings?.currency ?? 'ILS'

  /**
   * Format an amount using the user's preferred currency.
   * If an explicit `overrideCurrency` is provided it takes precedence
   * (useful for per-record currencies stored in the DB).
   */
  const formatAmount = useCallback(
    (amount: string | number | undefined | null, overrideCurrency?: string): string => {
      return formatCurrency(amount, overrideCurrency ?? currency)
    },
    [currency],
  )

  return { currency, formatAmount } as const
}
