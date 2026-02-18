import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import type { CSSProperties } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import DatePicker from '@/components/ui/DatePicker'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PeriodPreset = '7D' | '1M' | '3M' | '6M' | '1Y' | 'YTD' | 'CUSTOM'

export interface PeriodSelection {
  preset: PeriodPreset
  startDate: string // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD
}

interface PeriodSelectorProps {
  value: PeriodSelection
  onChange: (period: PeriodSelection) => void
  className?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

export function getDateRangeForPreset(preset: PeriodPreset): { startDate: string; endDate: string } {
  const today = new Date()
  const endDate = formatDate(today)
  let start: Date

  switch (preset) {
    case '7D':
      start = new Date(today)
      start.setDate(today.getDate() - 7)
      break
    case '1M':
      start = new Date(today)
      start.setMonth(today.getMonth() - 1)
      break
    case '3M':
      start = new Date(today)
      start.setMonth(today.getMonth() - 3)
      break
    case '6M':
      start = new Date(today)
      start.setMonth(today.getMonth() - 6)
      break
    case '1Y':
      start = new Date(today)
      start.setFullYear(today.getFullYear() - 1)
      break
    case 'YTD':
      start = new Date(today.getFullYear(), 0, 1)
      break
    default:
      start = new Date(today)
      start.setMonth(today.getMonth() - 1)
  }

  return { startDate: formatDate(start), endDate }
}

const PRESETS: PeriodPreset[] = ['7D', '1M', '3M', '6M', '1Y', 'YTD', 'CUSTOM']

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PeriodSelector({ value, onChange, className = '' }: PeriodSelectorProps) {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'he'

  const [isCustomOpen, setIsCustomOpen] = useState(false)
  const [customFrom, setCustomFrom] = useState(value.startDate)
  const [customTo, setCustomTo] = useState(value.endDate)

  const popoverRef = useRef<HTMLDivElement>(null)
  const customBtnRef = useRef<HTMLButtonElement>(null)

  // Sync custom dates when value changes externally
  useEffect(() => {
    if (value.preset === 'CUSTOM') {
      setCustomFrom(value.startDate)
      setCustomTo(value.endDate)
    }
  }, [value])

  // Close popover on outside click
  useEffect(() => {
    if (!isCustomOpen) return
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        customBtnRef.current &&
        !customBtnRef.current.contains(e.target as Node)
      ) {
        setIsCustomOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isCustomOpen])

  // Close on Escape
  useEffect(() => {
    if (!isCustomOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsCustomOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isCustomOpen])

  const handlePresetClick = useCallback(
    (preset: PeriodPreset) => {
      if (preset === 'CUSTOM') {
        setIsCustomOpen((prev) => !prev)
        return
      }
      setIsCustomOpen(false)
      const range = getDateRangeForPreset(preset)
      onChange({ preset, ...range })
    },
    [onChange],
  )

  const isValidRange = useMemo(() => {
    if (!customFrom || !customTo) return false
    return customTo >= customFrom
  }, [customFrom, customTo])

  const handleApply = useCallback(() => {
    if (!isValidRange) return
    onChange({
      preset: 'CUSTOM',
      startDate: customFrom,
      endDate: customTo,
    })
    setIsCustomOpen(false)
  }, [customFrom, customTo, isValidRange, onChange])

  const handleCancel = useCallback(() => {
    // Reset to current value dates
    setCustomFrom(value.startDate)
    setCustomTo(value.endDate)
    setIsCustomOpen(false)
  }, [value])

  return (
    <div
      className={`relative ${className}`}
      style={{ direction: isRtl ? 'rtl' : 'ltr', zIndex: isCustomOpen ? 70 : undefined }}
    >
      {/* Button group */}
      <div
        className="flex gap-1 rounded-xl p-1 overflow-x-auto scrollbar-hide"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
        role="group"
        aria-label={t('period.selectPeriod')}
      >
        {PRESETS.map((preset) => {
          const isActive = value.preset === preset
          const isCustom = preset === 'CUSTOM'

          return (
            <button
              key={preset}
              ref={isCustom ? customBtnRef : undefined}
              type="button"
              onClick={() => handlePresetClick(preset)}
              className="shrink-0 rounded-lg px-3 py-1.5 text-sm transition-all duration-200 whitespace-nowrap"
              style={{
                backgroundColor: isActive ? 'var(--color-brand-500)' : 'transparent',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 500,
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-hover)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
                }
              }}
              aria-pressed={isActive}
            >
              {t(`period.${preset}`)}
              {isCustom && (
                <ChevronDown
                  className="inline-block h-3.5 w-3.5 ms-1 transition-transform duration-200"
                  style={{
                    transform: isCustomOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Custom date range popover */}
      {isCustomOpen && (
        <div
          ref={popoverRef}
          className="absolute z-[60] mt-2 w-[320px] animate-fade-in-up rounded-xl border p-5"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-primary)',
            boxShadow: 'var(--shadow-lg)',
            backdropFilter: 'blur(16px) saturate(150%)',
            WebkitBackdropFilter: 'blur(16px) saturate(150%)',
            [isRtl ? 'right' : 'left']: 0,
          } as CSSProperties}
          role="dialog"
          aria-label={t('period.selectPeriod')}
        >
          {/* From date */}
          <div className="mb-4">
            <label
              className="mb-1.5 block text-xs font-semibold"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {t('period.fromDate')}
            </label>
            <DatePicker
              value={customFrom}
              onChange={setCustomFrom}
              className="w-full rounded-lg border px-3 py-2"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* To date */}
          <div className="mb-4">
            <label
              className="mb-1.5 block text-xs font-semibold"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {t('period.toDate')}
            </label>
            <DatePicker
              value={customTo}
              onChange={setCustomTo}
              className="w-full rounded-lg border px-3 py-2"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Validation message */}
          {customFrom && customTo && !isValidRange && (
            <p
              className="mb-3 text-xs font-medium"
              style={{ color: 'var(--color-danger)' }}
            >
              {t('period.toDate')} {'>='} {t('period.fromDate')}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleApply}
              disabled={!isValidRange}
              className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                backgroundColor: 'var(--color-brand-500)',
              }}
            >
              {t('period.apply')}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-200"
              style={{
                borderColor: 'var(--border-primary)',
                color: 'var(--text-secondary)',
                backgroundColor: 'transparent',
              }}
            >
              {t('period.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
