import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Banknote, CreditCard, Building2, ChevronDown } from 'lucide-react'
import type { PaymentMethod, CreditCard as CreditCardType, BankAccount } from '@/types'
import { creditCardsApi } from '@/api/credit-cards'
import { bankAccountsApi } from '@/api/bank-accounts'
import { queryKeys } from '@/lib/queryKeys'
import { cn } from '@/lib/utils'

interface PaymentMethodSelectorProps {
  paymentMethod: PaymentMethod
  onPaymentMethodChange: (method: PaymentMethod) => void
  creditCardId?: string | null
  onCreditCardChange: (id: string | null) => void
  bankAccountId?: string | null
  onBankAccountChange: (id: string | null) => void
  showForType?: 'income' | 'expense' | 'both'
}

const METHODS: { value: PaymentMethod; icon: typeof Banknote; tKey: string }[] = [
  { value: 'cash', icon: Banknote, tKey: 'paymentMethod.cash' },
  { value: 'credit_card', icon: CreditCard, tKey: 'paymentMethod.credit_card' },
  { value: 'bank_transfer', icon: Building2, tKey: 'paymentMethod.bank_transfer' },
]

export default function PaymentMethodSelector({
  paymentMethod,
  onPaymentMethodChange,
  creditCardId,
  onCreditCardChange,
  bankAccountId,
  onBankAccountChange,
  showForType = 'both',
}: PaymentMethodSelectorProps) {
  const { t } = useTranslation()

  // Fetch credit cards when needed
  const { data: creditCards = [] } = useQuery({
    queryKey: queryKeys.creditCards.list(),
    queryFn: creditCardsApi.list,
    staleTime: 5 * 60 * 1000,
    enabled: paymentMethod === 'credit_card',
  })

  // Fetch bank accounts when needed
  const { data: bankAccounts = [] } = useQuery({
    queryKey: queryKeys.bankAccounts.list(),
    queryFn: bankAccountsApi.list,
    staleTime: 5 * 60 * 1000,
    enabled: paymentMethod === 'bank_transfer',
  })

  // Filter methods based on type (income typically doesn't use credit cards)
  const availableMethods = showForType === 'income'
    ? METHODS.filter((m) => m.value !== 'credit_card')
    : METHODS

  return (
    <div className="space-y-3">
      {/* Label */}
      <label
        className="block text-xs font-semibold uppercase tracking-wider"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {t('paymentMethod.label')}
      </label>

      {/* Toggle buttons */}
      <div
        className="flex overflow-hidden rounded-xl border"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        {availableMethods.map((method) => {
          const active = paymentMethod === method.value
          const Icon = method.icon
          return (
            <button
              key={method.value}
              type="button"
              onClick={() => {
                onPaymentMethodChange(method.value)
                // Reset sub-selections when switching
                if (method.value !== 'credit_card') onCreditCardChange(null)
                if (method.value !== 'bank_transfer') onBankAccountChange(null)
              }}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-1',
              )}
              style={{
                backgroundColor: active ? 'var(--border-focus)' : 'var(--bg-input)',
                color: active ? '#fff' : 'var(--text-secondary)',
              }}
            >
              <Icon className="h-3.5 w-3.5" />
              {t(method.tKey)}
            </button>
          )
        })}
      </div>

      {/* Credit card dropdown */}
      {paymentMethod === 'credit_card' && (
        <div className="relative">
          {creditCards.length === 0 ? (
            <p
              className="rounded-xl border px-3 py-2.5 text-xs"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-tertiary)',
              }}
            >
              {t('paymentMethod.noCards')}
            </p>
          ) : (
            <div className="relative">
              <select
                value={creditCardId ?? ''}
                onChange={(e) => onCreditCardChange(e.target.value || null)}
                className={cn(
                  'w-full appearance-none rounded-xl border px-4 py-2.5 pe-9 text-sm outline-none transition-all',
                  'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                )}
                style={{
                  backgroundColor: 'var(--bg-input)',
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="">{t('paymentMethod.selectCard')}</option>
                {creditCards.map((card: CreditCardType) => (
                  <option key={card.id} value={card.id}>
                    {card.name} ****{card.last_four_digits}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute top-1/2 -translate-y-1/2 h-4 w-4 end-3"
                style={{ color: 'var(--text-tertiary)' }}
              />
            </div>
          )}
        </div>
      )}

      {/* Bank account dropdown */}
      {paymentMethod === 'bank_transfer' && (
        <div className="relative">
          {bankAccounts.length === 0 ? (
            <p
              className="rounded-xl border px-3 py-2.5 text-xs"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-tertiary)',
              }}
            >
              {t('paymentMethod.noAccounts')}
            </p>
          ) : (
            <div className="relative">
              <select
                value={bankAccountId ?? ''}
                onChange={(e) => onBankAccountChange(e.target.value || null)}
                className={cn(
                  'w-full appearance-none rounded-xl border px-4 py-2.5 pe-9 text-sm outline-none transition-all',
                  'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                )}
                style={{
                  backgroundColor: 'var(--bg-input)',
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="">{t('paymentMethod.selectAccount')}</option>
                {bankAccounts.map((account: BankAccount) => (
                  <option key={account.id} value={account.id}>
                    {account.name} - {account.bank_name}
                    {account.account_last_digits ? ` ****${account.account_last_digits}` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute top-1/2 -translate-y-1/2 h-4 w-4 end-3"
                style={{ color: 'var(--text-tertiary)' }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
