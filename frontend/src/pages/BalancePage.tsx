import { useTranslation } from 'react-i18next'

export default function BalancePage() {
  const { t } = useTranslation()

  return (
    <div>
      <h1 className="text-2xl font-bold">{t('balance.title')}</h1>
    </div>
  )
}
