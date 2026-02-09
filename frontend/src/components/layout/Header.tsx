import { useTranslation } from 'react-i18next'
import { Menu } from 'lucide-react'

interface HeaderProps {
  onMenuClick: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { t } = useTranslation()

  return (
    <header
      className="sticky top-0 z-30 flex h-14 items-center gap-3 px-4 md:hidden"
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-primary)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <button
        onClick={onMenuClick}
        className="flex h-9 w-9 items-center justify-center rounded-md transition-colors"
        style={{ color: 'var(--text-primary)' }}
      >
        <Menu size={22} />
      </button>

      <img
        src="/logo.jpeg"
        alt="Eye Level AI"
        className="h-8 w-auto rounded"
      />

      <h1
        className="brand-gradient-text text-sm font-semibold"
      >
        {t('app.name')}
      </h1>
    </header>
  )
}
