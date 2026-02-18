import { Tag } from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if a string is an emoji (vs plain text like "car") */
function isEmoji(str: string): boolean {
  // Emoji regex: matches common emoji ranges including ZWJ sequences
  const emojiRegex = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\u200D\uFE0F\u20E3]+$/u
  return emojiRegex.test(str.trim())
}

// ---------------------------------------------------------------------------
// CategoryIcon - renders a category icon inside a colored circle/bubble
// ---------------------------------------------------------------------------

interface CategoryIconProps {
  /** The icon string (emoji or text). If empty/undefined, shows a fallback Tag icon. */
  icon?: string
  /** The category color hex string, e.g. '#4318FF' */
  color?: string
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Additional className for the outer container */
  className?: string
}

const SIZE_CONFIG = {
  sm: {
    container: 'h-9 w-9',
    emoji: 'text-base',
    fallbackIcon: 'h-4 w-4',
    letter: 'text-xs font-bold',
  },
  md: {
    container: 'h-11 w-11',
    emoji: 'text-lg',
    fallbackIcon: 'h-4.5 w-4.5',
    letter: 'text-sm font-bold',
  },
  lg: {
    container: 'h-12 w-12',
    emoji: 'text-xl',
    fallbackIcon: 'h-5 w-5',
    letter: 'text-base font-bold',
  },
} as const

export function CategoryIcon({
  icon,
  color,
  size = 'md',
  className,
}: CategoryIconProps) {
  const cfg = SIZE_CONFIG[size]

  const bgColor = color ? `${color}18` : 'var(--bg-tertiary)'
  const textColor = color || 'var(--text-secondary)'
  const shadow = color ? `0 4px 12px ${color}15` : undefined

  const renderContent = () => {
    // No icon at all - show fallback Tag icon
    if (!icon || icon.trim() === '') {
      return <Tag className={cfg.fallbackIcon} />
    }

    // Emoji icon - render directly
    if (isEmoji(icon)) {
      return <span className={cn(cfg.emoji, 'leading-none select-none')}>{icon}</span>
    }

    // Text icon (like "car", "food") - show only first character, uppercased
    return (
      <span className={cn(cfg.letter, 'leading-none uppercase select-none')}>
        {icon.charAt(0)}
      </span>
    )
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-xl overflow-hidden',
        cfg.container,
        className,
      )}
      style={{
        backgroundColor: bgColor,
        color: textColor,
        boxShadow: shadow,
      }}
    >
      {renderContent()}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CategoryBadge - inline pill badge with icon + label (used in tables/lists)
// ---------------------------------------------------------------------------

interface CategoryBadgeProps {
  /** The category icon string */
  icon?: string
  /** The category color hex */
  color?: string
  /** Display label (category name) */
  label: string
}

export function CategoryBadge({ icon, color, label }: CategoryBadgeProps) {
  const bgColor = color ? `${color}18` : 'var(--bg-tertiary)'
  const textColor = color ?? 'var(--text-secondary)'
  const borderColor = color ? `${color}25` : 'var(--border-primary)'

  const renderIcon = () => {
    if (!icon || icon.trim() === '') return null

    if (isEmoji(icon)) {
      return <span className="text-sm leading-none shrink-0 select-none">{icon}</span>
    }

    // For text icons in the badge, show just the first character
    return (
      <span className="text-xs font-bold leading-none uppercase shrink-0 select-none">
        {icon.charAt(0)}
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium overflow-hidden max-w-full"
      style={{ backgroundColor: bgColor, color: textColor, borderColor }}
    >
      {renderIcon()}
      <span className="truncate">{label}</span>
    </span>
  )
}
