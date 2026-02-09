import { useTranslation } from 'react-i18next'

export default function TransactionsPage() {
  const { t } = useTranslation()

  return (
    <div>
      <h1 className="text-2xl font-bold">{t('transactions.title')}</h1>
    </div>
  )
}
