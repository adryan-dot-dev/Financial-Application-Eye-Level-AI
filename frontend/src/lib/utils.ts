import { clsx } from 'clsx'
import type { ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

/** Map currency code to the most natural locale for that currency */
function currencyLocale(currency: string): string {
  switch (currency) {
    case 'USD': return 'en-US'
    case 'EUR': return 'de-DE'
    case 'ILS':
    default: return 'he-IL'
  }
}

export function formatCurrency(amount: string | number | undefined | null, currency = 'ILS'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0)
  if (isNaN(num)) return formatCurrency(0, currency)
  return new Intl.NumberFormat(currencyLocale(currency), {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(num)
}

export function formatDate(dateStr: string | undefined | null, locale = 'he-IL'): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
