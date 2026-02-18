import { useTranslation } from 'react-i18next'
import { getCurrencySymbol, getCurrencyFlag } from '@/lib/utils'

const CURRENCIES = ['ILS', 'USD', 'EUR'] as const

interface CurrencySelectorProps {
  value: string
  onChange: (currency: string) => void
  className?: string
  id?: string
}

export default function CurrencySelector({
  value,
  onChange,
  className = '',
  id,
}: CurrencySelectorProps) {
  const { t } = useTranslation()

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 ${className}`}
      aria-label={t('currency.selectCurrency')}
    >
      {CURRENCIES.map((code) => (
        <option key={code} value={code}>
          {getCurrencyFlag(code)} {getCurrencySymbol(code)} {t(`currency.${code}`)}
        </option>
      ))}
    </select>
  )
}
