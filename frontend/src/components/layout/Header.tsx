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
        className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
        style={{ color: 'var(--text-primary)' }}
        aria-label={t('nav.menu')}
      >
        <Menu size={20} />
      </button>

      <div className="flex items-center gap-2.5">
        <img
          src="/logo.webp"
          alt={t('app.company')}
          className="h-7 w-auto rounded-lg"
        />
        <h1
          className="text-sm font-bold"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('app.name')}
        </h1>
      </div>
    </header>
  )
}
