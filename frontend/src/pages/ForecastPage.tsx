import { useTranslation } from 'react-i18next'

export default function ForecastPage() {
  const { t } = useTranslation()

  return (
    <div>
      <h1 className="text-2xl font-bold">{t('forecast.title')}</h1>
    </div>
  )
}
