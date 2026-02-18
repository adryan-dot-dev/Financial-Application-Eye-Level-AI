import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  ScrollText,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
} from 'lucide-react'
import type { AuditLogEntry, AuditLogResponse } from '@/types'
import apiClient from '@/api/client'
import { queryKeys } from '@/lib/queryKeys'
import { formatDate } from '@/lib/utils'

const PAGE_SIZE = 20

async function fetchAuditLog(
  orgId: string,
  params: { page: number; user?: string; action?: string },
): Promise<AuditLogResponse> {
  const query: Record<string, string | number> = {
    page: params.page,
    page_size: PAGE_SIZE,
  }
  if (params.user) query.user = params.user
  if (params.action) query.action = params.action

  const response = await apiClient.get(`/organizations/${orgId}/audit-log`, { params: query })
  const data = response.data
  // Normalise: API may return {items,total,page,page_size,pages} or plain array
  if (Array.isArray(data)) {
    return { items: data as AuditLogEntry[], total: data.length, page: 1, page_size: PAGE_SIZE, pages: 1 }
  }
  return data as AuditLogResponse
}

export default function OrgAuditLogTab({ orgId }: { orgId: string }) {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'he'

  const [page, setPage] = useState(1)
  const [userFilter, setUserFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  const params = {
    page,
    user: userFilter || undefined,
    action: actionFilter || undefined,
  }

  const { data, isLoading } = useQuery<AuditLogResponse>({
    queryKey: queryKeys.auditLog.list(orgId, { page, user: userFilter, action: actionFilter }),
    queryFn: () => fetchAuditLog(orgId, params),
    placeholderData: (prev) => prev,
  })

  const entries = data?.items ?? []
  const totalPages = data?.pages ?? 1

  const handleUserChange = useCallback((value: string) => {
    setUserFilter(value)
    setPage(1)
  }, [])

  const handleActionChange = useCallback((value: string) => {
    setActionFilter(value)
    setPage(1)
  }, [])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: 'var(--text-tertiary)', insetInlineStart: '0.75rem' }}
          />
          <input
            type="text"
            value={userFilter}
            onChange={(e) => handleUserChange(e.target.value)}
            placeholder={t('auditLog.filterByUser')}
            className="input w-full text-sm"
            style={{ paddingInlineStart: '2.25rem' }}
            dir="ltr"
          />
        </div>
        <div className="relative sm:w-48">
          <Filter
            className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: 'var(--text-tertiary)', insetInlineStart: '0.75rem' }}
          />
          <input
            type="text"
            value={actionFilter}
            onChange={(e) => handleActionChange(e.target.value)}
            placeholder={t('auditLog.filterByAction')}
            className="input w-full text-sm"
            style={{ paddingInlineStart: '2.25rem' }}
            dir="ltr"
          />
        </div>
      </div>

      {/* Table */}
      {isLoading && entries.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card flex items-center gap-4 p-4">
              <div className="skeleton h-4 w-28 rounded" />
              <div className="skeleton h-4 w-32 rounded" />
              <div className="skeleton h-4 w-20 rounded" />
              <div className="skeleton h-4 flex-1 rounded" />
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-4 py-16">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'var(--bg-hover)' }}
          >
            <ScrollText className="h-7 w-7" style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('auditLog.noLogs')}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                  {[
                    t('auditLog.timestamp'),
                    t('auditLog.user'),
                    t('auditLog.action'),
                    t('auditLog.entity'),
                    t('auditLog.details'),
                  ].map((header) => (
                    <th
                      key={header}
                      className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-secondary)' }}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="transition-colors hover:bg-[var(--bg-hover)]"
                    style={{ borderBottom: '1px solid var(--border-primary)' }}
                  >
                    <td className="whitespace-nowrap px-4 py-3 ltr-nums" style={{ color: 'var(--text-tertiary)' }}>
                      {formatDate(entry.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3" style={{ color: 'var(--text-primary)' }} dir="ltr">
                      {entry.user_email}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className="inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold"
                        style={{ backgroundColor: 'var(--bg-info)', color: 'var(--color-info)' }}
                      >
                        {entry.action}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                      {entry.entity_type}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3" style={{ color: 'var(--text-tertiary)' }}>
                      {entry.details ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              className="flex items-center justify-between border-t px-4 py-3"
              style={{ borderColor: 'var(--border-primary)' }}
            >
              <span className="text-xs ltr-nums" style={{ color: 'var(--text-tertiary)' }}>
                {page} / {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-40"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-40"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {isRtl ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
