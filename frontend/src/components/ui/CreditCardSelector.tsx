import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CreditCard as CreditCardIcon, ChevronDown } from 'lucide-react'
import type { CreditCard } from '@/types'
import { creditCardsApi } from '@/api/credit-cards'
import { queryKeys } from '@/lib/queryKeys'

interface CreditCardSelectorProps {
  value: string | null | undefined
  onChange: (cardId: string | null) => void
  optional?: boolean // shows "ללא כרטיס" / "No Card" option
  className?: string
  disabled?: boolean
}

function getUtilizationColor(pct: number): string {
  if (pct >= 90) return 'var(--color-danger)'
  if (pct >= 80) return 'var(--color-warning-dark, var(--color-warning))'
  if (pct >= 50) return 'var(--color-warning)'
  return 'var(--color-success)'
}

export default function CreditCardSelector({
  value,
  onChange,
  optional = true,
  className = '',
  disabled = false,
}: CreditCardSelectorProps) {
  const { t } = useTranslation()

  const { data: cards = [], isLoading } = useQuery({
    queryKey: queryKeys.creditCards.list(),
    queryFn: creditCardsApi.list,
    staleTime: 5 * 60 * 1000,
  })

  return (
    <div className={`relative ${className}`}>
      <label
        className="mb-1.5 block text-xs font-semibold"
        style={{ color: 'var(--text-tertiary)' }}
      >
        <CreditCardIcon className="inline-block h-3.5 w-3.5 me-1 opacity-60" />
        {t('creditCards.selectCard')}
      </label>
      <div className="relative">
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled || isLoading}
          className="w-full appearance-none rounded-lg border px-3 py-2.5 pe-9 text-sm transition-colors duration-200"
          style={{
            borderColor: 'var(--border-primary)',
            backgroundColor: 'var(--bg-input)',
            color: 'var(--text-primary)',
          }}
        >
          {optional && (
            <option value="">{t('creditCards.noCard')}</option>
          )}
          {isLoading && (
            <option value="" disabled>{t('common.loading')}</option>
          )}
          {cards.map((card: CreditCard) => (
            <option key={card.id} value={card.id}>
              {card.name} ****{card.last_four_digits}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 -translate-y-1/2 h-4 w-4 end-2.5"
          style={{ color: 'var(--text-tertiary)' }}
        />
      </div>
      {/* Show utilization indicator for selected card */}
      {value && cards.length > 0 && (() => {
        const selected = cards.find((c: CreditCard) => c.id === value)
        if (!selected) return null
        return (
          <div
            className="mt-1 flex items-center gap-2 text-xs"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: getUtilizationColor(selected.utilization_percentage) }}
            />
            <span>
              {t('creditCards.utilization')}: {selected.utilization_percentage}%
            </span>
            <span className="mx-1">·</span>
            <span>
              {t('creditCards.available')}: {selected.available_credit} {selected.currency}
            </span>
          </div>
        )
      })()}
    </div>
  )
}
