import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import type { PageStableId } from '../types/statsig'

import { getUserDetails } from '../handlers/get-user-details'
import {
  clearManualStableId as clearStoredManualStableId,
  getManualStableId,
  saveManualStableId as saveStoredManualStableId,
} from '../lib/manual-stable-id'
import { getActiveIntakeTab } from '../lib/tabs'

type TesterStableIdSource = 'localStorage' | 'manual' | 'sdk'

export interface TesterStableId {
  /** The ID to force with. Undefined when none is detected or typed in. */
  stableId?: string
  source?: TesterStableIdSource
  /** SDK tier (REQ-OVR-007). Undefined when the SDK reports none; F07 defaults to production. */
  environmentTier?: string
  /** The typed-in ID for this origin, whether or not it is in use. */
  manualStableId?: string
  /** The page read, or the read of the typed-in ID, is still running. */
  isLoading: boolean
  /** The page read finished on an Intake tab and found no Stable ID (REQ-OVR-005). */
  isMissing: boolean
  /** The page read is running again after `refetch`. */
  isRefetching: boolean
  saveManualStableId: (value: string) => Promise<void>
  clearManualStableId: () => Promise<void>
  refetch: () => Promise<void>
}

type PageRead = { hasTab: false } | { hasTab: true; origin: string; detected?: PageStableId; environmentTier?: string }

const pageQueryKey = ['tester-stable-id', 'page'] as const
const manualQueryKey = (origin: string | undefined) => ['tester-stable-id', 'manual', origin] as const

const readPage = async (): Promise<PageRead> => {
  const tab = await getActiveIntakeTab()
  if (!tab?.url) {
    return { hasTab: false }
  }

  const { origin } = new URL(tab.url)

  try {
    const details = await getUserDetails(tab)
    return { detected: details?.stableId, environmentTier: details?.environmentTier, hasTab: true, origin }
  } catch {
    // A read that throws counts as "no ID found". Keep the origin so the Tester can still type an ID in.
    return { hasTab: true, origin }
  }
}

const resolveStableId = (
  detected: PageStableId | undefined,
  manualStableId: string | undefined,
): Pick<TesterStableId, 'source' | 'stableId'> => {
  if (detected) {
    return { source: detected.source, stableId: detected.value }
  }
  if (manualStableId !== undefined) {
    return { source: 'manual', stableId: manualStableId }
  }
  return {}
}

/** The typed-in ID for one origin, kept in the query cache so every hook instance sees the same value. */
const useManualStableId = (origin: string | undefined) => {
  const queryClient = useQueryClient()

  const { data, isPending } = useQuery({
    enabled: origin !== undefined,
    queryFn: async () => (origin === undefined ? null : ((await getManualStableId(origin)) ?? null)),
    queryKey: manualQueryKey(origin),
  })

  const saveManualStableId = useCallback(
    async (value: string) => {
      if (origin === undefined) {
        throw new Error('No Intake Site tab found')
      }
      await saveStoredManualStableId(origin, value)
      queryClient.setQueryData(manualQueryKey(origin), value.trim())
    },
    [origin, queryClient],
  )

  const clearManualStableId = useCallback(async () => {
    if (origin === undefined) {
      throw new Error('No Intake Site tab found')
    }
    await clearStoredManualStableId(origin)
    queryClient.setQueryData(manualQueryKey(origin), null)
  }, [origin, queryClient])

  return {
    clearManualStableId,
    // A disabled query is pending too, so only count it once the origin is known.
    isReading: origin !== undefined && isPending,
    manualStableId: data ?? undefined,
    saveManualStableId,
  }
}

/**
 * The Stable ID to force with (REQ-OVR-004, REQ-OVR-005).
 * A detected ID always wins. A typed-in ID is used only while the page read finds nothing.
 */
export const useTesterStableId = (): TesterStableId => {
  const pageQuery = useQuery({
    queryFn: readPage,
    queryKey: pageQueryKey,
    refetchOnWindowFocus: false,
    retry: false,
  })

  const { data: page, refetch: refetchPage } = pageQuery
  const origin = page?.hasTab ? page.origin : undefined
  const detected = page?.hasTab ? page.detected : undefined
  const { clearManualStableId, isReading, manualStableId, saveManualStableId } = useManualStableId(origin)

  const refetch = useCallback(async () => {
    await refetchPage()
  }, [refetchPage])

  return {
    clearManualStableId,
    environmentTier: page?.hasTab ? page.environmentTier : undefined,
    // A detected ID wins, so it does not wait for the typed-in ID. Without one, the typed-in ID decides what shows.
    isLoading: pageQuery.isPending || (detected === undefined && isReading),
    isMissing: page?.hasTab === true && detected === undefined,
    isRefetching: pageQuery.isRefetching,
    manualStableId,
    refetch,
    saveManualStableId,
    ...resolveStableId(detected, manualStableId),
  }
}
