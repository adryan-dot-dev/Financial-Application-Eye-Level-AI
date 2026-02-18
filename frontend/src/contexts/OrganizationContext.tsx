import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Organization } from '@/types'
import { organizationsApi } from '@/api/organizations'
import { useAuth } from '@/contexts/AuthContext'
import { queryKeys } from '@/lib/queryKeys'

interface OrganizationContextValue {
  /** The currently active organization, or null for personal view */
  currentOrg: Organization | null
  /** All organizations the user is a member of */
  orgs: Organization[]
  /** Whether the user is currently viewing org data */
  isOrgView: boolean
  /** Whether orgs are still loading */
  isLoading: boolean
  /** Switch to a specific org, or null for personal view */
  switchOrg: (orgId: string | null) => Promise<void>
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null)

const CURRENT_ORG_KEY = 'current_organization_id'

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(() => {
    return localStorage.getItem(CURRENT_ORG_KEY) || null
  })

  // Fetch all orgs the user belongs to
  const { data: orgs = [], isLoading } = useQuery<Organization[]>({
    queryKey: queryKeys.organizations.list(),
    queryFn: organizationsApi.list,
    enabled: isAuthenticated,
  })

  // Derive the current org object from the list
  const currentOrg = useMemo(() => {
    if (!currentOrgId) return null
    return orgs.find((org) => org.id === currentOrgId) ?? null
  }, [currentOrgId, orgs])

  // If the stored org ID is no longer valid (e.g. user was removed), reset to personal
  useEffect(() => {
    if (!isLoading && currentOrgId && orgs.length > 0) {
      const stillMember = orgs.some((org) => org.id === currentOrgId)
      if (!stillMember) {
        setCurrentOrgId(null)
        localStorage.removeItem(CURRENT_ORG_KEY)
      }
    }
  }, [isLoading, currentOrgId, orgs])

  // Clear org context on logout
  useEffect(() => {
    if (!isAuthenticated) {
      setCurrentOrgId(null)
      localStorage.removeItem(CURRENT_ORG_KEY)
    }
  }, [isAuthenticated])

  const switchOrg = useCallback(
    async (orgId: string | null) => {
      // Call backend to persist the switch
      await organizationsApi.switchOrg(orgId)

      // Update local state
      setCurrentOrgId(orgId)
      if (orgId) {
        localStorage.setItem(CURRENT_ORG_KEY, orgId)
      } else {
        localStorage.removeItem(CURRENT_ORG_KEY)
      }

      // Invalidate all data queries so they refetch with the new org context
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.forecast.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.balance.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.fixed.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.installments.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.loans.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.categories.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all }),
      ])
    },
    [queryClient],
  )

  const isOrgView = currentOrg !== null

  const value = useMemo<OrganizationContextValue>(
    () => ({
      currentOrg,
      orgs,
      isOrgView,
      isLoading,
      switchOrg,
    }),
    [currentOrg, orgs, isOrgView, isLoading, switchOrg],
  )

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization() {
  const context = useContext(OrganizationContext)
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider')
  }
  return context
}
