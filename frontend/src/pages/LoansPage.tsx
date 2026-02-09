import { useTranslation } from 'react-i18next'

export default function LoansPage() {
  const { t } = useTranslation()

  return (
    <div>
      <h1 className="text-2xl font-bold">{t('loans.title')}</h1>
    </div>
  )
}
