import { useTranslation } from 'react-i18next'

export default function InstallmentsPage() {
  const { t } = useTranslation()

  return (
    <div>
      <h1 className="text-2xl font-bold">{t('installments.title')}</h1>
    </div>
  )
}
