import { useTranslation } from 'react-i18next'

export default function FixedPage() {
  const { t } = useTranslation()

  return (
    <div>
      <h1 className="text-2xl font-bold">{t('fixed.title')}</h1>
    </div>
  )
}
