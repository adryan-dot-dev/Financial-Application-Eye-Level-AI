import { useTranslation } from 'react-i18next'

export default function AlertsPage() {
  const { t } = useTranslation()

  return (
    <div>
      <h1 className="text-2xl font-bold">{t('alerts.title')}</h1>
    </div>
  )
}
