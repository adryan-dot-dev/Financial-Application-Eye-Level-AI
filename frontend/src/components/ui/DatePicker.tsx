import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DatePickerProps {
  value: string // YYYY-MM-DD
  onChange: (value: string) => void
  className?: string
  style?: CSSProperties
  placeholder?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

function toYMD(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DatePicker({
  value,
  onChange,
  className = '',
  style,
  placeholder,
  ...ariaProps
}: DatePickerProps) {
  const { i18n } = useTranslation()
  const isRtl = i18n.language === 'he'
  const locale = isRtl ? 'he-IL' : 'en-US'

  const [isOpen, setIsOpen] = useState(false)
  const [viewYear, setViewYear] = useState(() => {
    if (value) return new Date(value + 'T00:00:00').getFullYear()
    return new Date().getFullYear()
  })
  const [viewMonth, setViewMonth] = useState(() => {
    if (value) return new Date(value + 'T00:00:00').getMonth()
    return new Date().getMonth()
  })

  // Position state for portal-based calendar
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 })

  const triggerRef = useRef<HTMLButtonElement>(null)
  const calendarRef = useRef<HTMLDivElement>(null)

  const today = useMemo(() => new Date(), [])
  const selectedDate = useMemo(() => {
    if (!value) return null
    return new Date(value + 'T00:00:00')
  }, [value])

  // Sync view when value changes externally
  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00')
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
  }, [value])

  // Calculate popup position from trigger bounding rect
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const POPUP_WIDTH = 320
    const POPUP_HEIGHT_ESTIMATE = 400
    const GAP = 8

    let top = rect.bottom + GAP
    let left: number

    if (isRtl) {
      // Align right edge of popup to right edge of trigger
      left = rect.right - POPUP_WIDTH
    } else {
      left = rect.left
    }

    // Clamp horizontal — prevent going off screen
    if (left < 8) left = 8
    if (left + POPUP_WIDTH > window.innerWidth - 8) {
      left = window.innerWidth - POPUP_WIDTH - 8
    }

    // If not enough space below, open above
    if (top + POPUP_HEIGHT_ESTIMATE > window.innerHeight - 8) {
      top = rect.top - GAP - POPUP_HEIGHT_ESTIMATE
      if (top < 8) top = 8
    }

    setPopupPos({ top, left })
  }, [isRtl])

  // Reposition when open, on scroll / resize
  useEffect(() => {
    if (!isOpen) return
    updatePosition()

    const onReposition = () => updatePosition()
    window.addEventListener('scroll', onReposition, true)
    window.addEventListener('resize', onReposition)
    return () => {
      window.removeEventListener('scroll', onReposition, true)
      window.removeEventListener('resize', onReposition)
    }
  }, [isOpen, updatePosition])

  // Close on outside click — check both trigger and portal calendar
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      const inTrigger = triggerRef.current?.contains(target)
      const inCalendar = calendarRef.current?.contains(target)
      if (!inTrigger && !inCalendar) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen])

  // Navigation
  const goToPrevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1)
        return 11
      }
      return m - 1
    })
  }, [])

  const goToNextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1)
        return 0
      }
      return m + 1
    })
  }, [])

  const goToToday = useCallback(() => {
    const now = new Date()
    setViewYear(now.getFullYear())
    setViewMonth(now.getMonth())
  }, [])

  // Select a day
  const selectDay = useCallback((day: number) => {
    const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
    onChange(dateStr)
    setIsOpen(false)
  }, [viewYear, viewMonth, onChange])

  // Day name headers starting from Sunday
  const weekDayHeaders = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'narrow' })
    // Generate Sunday=0 through Saturday=6
    return Array.from({ length: 7 }, (_, i) => {
      // Use a known Sunday: Jan 7, 2024
      const d = new Date(2024, 0, 7 + i)
      return formatter.format(d)
    })
  }, [locale])

  // Month name
  const monthName = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' })
    return formatter.format(new Date(viewYear, viewMonth, 1))
  }, [locale, viewYear, viewMonth])

  // Calendar grid
  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(viewYear, viewMonth)
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth)
    const daysInPrevMonth = getDaysInMonth(viewYear, viewMonth - 1)

    const cells: Array<{ day: number; isCurrentMonth: boolean; date: Date }> = []

    // Previous month trailing days
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i
      const m = viewMonth === 0 ? 11 : viewMonth - 1
      const y = viewMonth === 0 ? viewYear - 1 : viewYear
      cells.push({ day, isCurrentMonth: false, date: new Date(y, m, day) })
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, isCurrentMonth: true, date: new Date(viewYear, viewMonth, d) })
    }

    // Next month leading days (fill to 42 = 6 rows)
    const remaining = 42 - cells.length
    for (let d = 1; d <= remaining; d++) {
      const m = viewMonth === 11 ? 0 : viewMonth + 1
      const y = viewMonth === 11 ? viewYear + 1 : viewYear
      cells.push({ day: d, isCurrentMonth: false, date: new Date(y, m, d) })
    }

    return cells
  }, [viewYear, viewMonth])

  // Display value
  const displayValue = useMemo(() => {
    if (!value) return ''
    const d = new Date(value + 'T00:00:00')
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d)
  }, [value, locale])

  const PrevIcon = isRtl ? ChevronRight : ChevronLeft
  const NextIcon = isRtl ? ChevronLeft : ChevronRight

  // Calendar popup rendered via portal
  const calendarPopup = isOpen
    ? createPortal(
        <div
          ref={calendarRef}
          className="animate-fade-in-up rounded-2xl border p-4"
          style={{
            position: 'fixed',
            zIndex: 100,
            top: popupPos.top,
            left: popupPos.left,
            minWidth: 300,
            width: 320,
            direction: isRtl ? 'rtl' : 'ltr',
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-primary)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.05)',
            backdropFilter: 'blur(20px) saturate(150%)',
            WebkitBackdropFilter: 'blur(20px) saturate(150%)',
          }}
          role="dialog"
          aria-label="Date picker"
        >
          {/* Month/Year header with navigation */}
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={goToPrevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:bg-[var(--bg-hover)]"
              style={{ color: 'var(--text-secondary)' }}
              aria-label="Previous month"
            >
              <PrevIcon className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={goToToday}
              className="text-sm font-bold transition-colors hover:text-[var(--color-brand-500)]"
              style={{ color: 'var(--text-primary)' }}
              title="Go to today"
            >
              {monthName}
            </button>

            <button
              type="button"
              onClick={goToNextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:bg-[var(--bg-hover)]"
              style={{ color: 'var(--text-secondary)' }}
              aria-label="Next month"
            >
              <NextIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Day name headers */}
          <div className="mb-1 grid grid-cols-7 gap-0">
            {weekDayHeaders.map((name, i) => (
              <div
                key={i}
                className="flex h-8 items-center justify-center text-[11px] font-semibold uppercase"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {name}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-0">
            {calendarDays.map((cell, i) => {
              const isToday = isSameDay(cell.date, today)
              const isSelected = selectedDate ? isSameDay(cell.date, selectedDate) : false

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    if (cell.isCurrentMonth) {
                      selectDay(cell.day)
                    } else {
                      // Navigate to that month and select
                      setViewYear(cell.date.getFullYear())
                      setViewMonth(cell.date.getMonth())
                      onChange(toYMD(cell.date))
                      setIsOpen(false)
                    }
                  }}
                  className="flex h-9 w-full items-center justify-center rounded-xl text-sm font-medium transition-all"
                  style={{
                    color: isSelected
                      ? '#fff'
                      : !cell.isCurrentMonth
                        ? 'var(--text-tertiary)'
                        : isToday
                          ? 'var(--color-brand-500)'
                          : 'var(--text-primary)',
                    backgroundColor: isSelected
                      ? 'var(--color-brand-500)'
                      : isToday && !isSelected
                        ? 'rgba(67, 24, 255, 0.08)'
                        : 'transparent',
                    opacity: cell.isCurrentMonth ? 1 : 0.4,
                    fontWeight: isToday || isSelected ? 700 : 500,
                  }}
                >
                  <span className="ltr-nums">{cell.day}</span>
                </button>
              )
            })}
          </div>

          {/* Today shortcut */}
          <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--border-primary)' }}>
            <button
              type="button"
              onClick={() => {
                onChange(toYMD(today))
                setIsOpen(false)
              }}
              className="w-full rounded-xl px-3 py-2 text-xs font-semibold transition-all hover:bg-[var(--bg-hover)]"
              style={{ color: 'var(--color-brand-500)' }}
            >
              {isRtl ? 'היום' : 'Today'}
            </button>
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <div className="relative" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
      {/* Trigger button styled as input */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex w-full items-center gap-2 text-start ${className}`}
        style={style}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        {...ariaProps}
      >
        <Calendar className="h-4 w-4 shrink-0" style={{ color: 'var(--color-brand-500)' }} />
        <span
          className="flex-1 truncate text-sm"
          style={{ color: value ? 'var(--text-primary)' : 'var(--text-tertiary)', opacity: value ? 1 : 0.7 }}
        >
          {displayValue || placeholder || 'Select date'}
        </span>
      </button>

      {/* Calendar popup via portal */}
      {calendarPopup}
    </div>
  )
}
