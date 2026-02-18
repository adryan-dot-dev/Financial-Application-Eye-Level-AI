import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, ChevronDown, User, Loader2 } from 'lucide-react'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useToast } from '@/contexts/ToastContext'
import { getApiErrorMessage } from '@/api/client'
import { cn } from '@/lib/utils'

interface OrgSwitcherProps {
  collapsed?: boolean
}

export default function OrgSwitcher({ collapsed = false }: OrgSwitcherProps) {
  const { t } = useTranslation()
  const { currentOrg, orgs, switchOrg, isLoading } = useOrganization()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [open])

  const handleSwitch = useCallback(
    async (orgId: string | null) => {
      if (switching) return
      setSwitching(true)
      try {
        await switchOrg(orgId)
        setOpen(false)
        toast.success(
          orgId
            ? t('organizations.switchedToOrg')
            : t('organizations.switchedToPersonal'),
        )
      } catch (err: unknown) {
        toast.error(t('toast.error'), getApiErrorMessage(err))
      } finally {
        setSwitching(false)
      }
    },
    [switchOrg, switching, t, toast],
  )

  // Don't show switcher if loading or no orgs
  if (isLoading || orgs.length === 0) return null

  return (
    <div ref={dropdownRef} className="relative mx-2 mb-2">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start transition-all duration-200',
          'hover:bg-white/[0.06]',
          open && 'bg-white/[0.08]',
          collapsed && 'justify-center px-2',
        )}
        style={{ color: 'var(--text-sidebar)' }}
        title={currentOrg ? currentOrg.name : t('organizations.personal')}
      >
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200',
          )}
          style={{
            backgroundColor: currentOrg
              ? 'rgba(134, 140, 255, 0.15)'
              : 'rgba(255, 255, 255, 0.08)',
            color: currentOrg
              ? 'rgb(167, 139, 250)'
              : 'rgba(255, 255, 255, 0.6)',
          }}
        >
          {currentOrg ? (
            <Building2 className="h-3.5 w-3.5" />
          ) : (
            <User className="h-3.5 w-3.5" />
          )}
        </span>

        {!collapsed && (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold leading-tight text-white">
                {currentOrg ? currentOrg.name : t('organizations.personal')}
              </p>
              <p
                className="truncate text-[10px]"
                style={{ color: 'rgba(255, 255, 255, 0.45)' }}
              >
                {currentOrg
                  ? t('organizations.orgView')
                  : t('organizations.personalView')}
              </p>
            </div>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
                open && 'rotate-180',
              )}
              style={{ color: 'rgba(255, 255, 255, 0.4)' }}
            />
          </>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={cn(
            'absolute z-50 mt-1 w-56 overflow-hidden rounded-xl border shadow-xl',
            collapsed ? 'start-full ms-2' : 'start-0 w-full',
          )}
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-primary)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.25)',
            top: collapsed ? '0' : 'auto',
          }}
        >
          {/* Header */}
          <div
            className="border-b px-3 py-2"
            style={{ borderColor: 'var(--border-primary)' }}
          >
            <p
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {t('organizations.switchContext')}
            </p>
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {/* Personal option */}
            <button
              onClick={() => handleSwitch(null)}
              disabled={switching}
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-2.5 text-start transition-colors hover:bg-[var(--bg-hover)]',
                !currentOrg && 'bg-[var(--bg-hover)]',
              )}
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: !currentOrg
                    ? 'var(--bg-info)'
                    : 'var(--bg-hover)',
                  color: !currentOrg
                    ? 'var(--color-info)'
                    : 'var(--text-tertiary)',
                }}
              >
                <User className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-[13px] font-medium"
                  style={{
                    color: !currentOrg
                      ? 'var(--color-info)'
                      : 'var(--text-primary)',
                  }}
                >
                  {t('organizations.personal')}
                </p>
                <p
                  className="text-[10px]"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {t('organizations.personalDesc')}
                </p>
              </div>
              {switching && !currentOrg && (
                <Loader2
                  className="h-3.5 w-3.5 shrink-0 animate-spin"
                  style={{ color: 'var(--text-tertiary)' }}
                />
              )}
            </button>

            {/* Divider */}
            <div
              className="mx-3 my-1 h-px"
              style={{ backgroundColor: 'var(--border-primary)' }}
            />

            {/* Organizations */}
            {orgs.map((org) => {
              const isActive = currentOrg?.id === org.id
              return (
                <button
                  key={org.id}
                  onClick={() => handleSwitch(org.id)}
                  disabled={switching}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-3 py-2.5 text-start transition-colors hover:bg-[var(--bg-hover)]',
                    isActive && 'bg-[var(--bg-hover)]',
                  )}
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold"
                    style={{
                      backgroundColor: isActive
                        ? 'rgba(134, 140, 255, 0.12)'
                        : 'var(--bg-hover)',
                      color: isActive
                        ? 'rgb(139, 92, 246)'
                        : 'var(--text-secondary)',
                    }}
                  >
                    {org.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-[13px] font-medium"
                      style={{
                        color: isActive
                          ? 'rgb(139, 92, 246)'
                          : 'var(--text-primary)',
                      }}
                    >
                      {org.name}
                    </p>
                  </div>
                  {switching && isActive && (
                    <Loader2
                      className="h-3.5 w-3.5 shrink-0 animate-spin"
                      style={{ color: 'var(--text-tertiary)' }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
