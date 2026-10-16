import { browser } from 'wxt/browser'

import type { DetectedStatsigKeys } from '../lib/projects'
import type { getActiveTab } from '../lib/tabs'
import type { PageStableId, StatsigUser } from '../types/statsig'

import { getUserDetailsFromPage } from '../lib/get-user-details-injector'
import { isIntakeSiteUrl } from '../lib/intake-site'
import { handleApiError } from '../lib/utils'

type TabLike = Pick<NonNullable<Awaited<ReturnType<typeof getActiveTab>>>, 'id' | 'url'>

export interface UserDetails {
  user: StatsigUser
  context?: Record<string, unknown>
  /** Identifiers that tell which Statsig project the page belongs to. */
  keys?: DetectedStatsigKeys
  /** The Tester's Stable ID and where it came from (REQ-OVR-004). */
  stableId?: PageStableId
  /** `getContext().options.environment.tier`, when the SDK reports one (REQ-OVR-007). */
  environmentTier?: string
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

// The page runs in the MAIN world, so its own scripts can change what the SDK returns.
// The extension checks the two new fields again before it uses them.
const sanitizeStableId = (value: unknown): PageStableId | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const { source, value: id } = value
  if ((source !== 'sdk' && source !== 'localStorage') || typeof id !== 'string') {
    return undefined
  }

  const trimmed = id.trim()
  return trimmed === '' ? undefined : { source, value: trimmed }
}

const sanitizeEnvironmentTier = (value: unknown) => (typeof value === 'string' && value !== '' ? value : undefined)

const sanitizePage = (page: NonNullable<ReturnType<typeof getUserDetailsFromPage>>): UserDetails | undefined => {
  const { environmentTier, href, stableId, ...details } = page

  // The tab URL was checked before injection, but the page can navigate before the script runs.
  // The href the page reports is the one the script ran on, so check that one again.
  if (typeof href !== 'string' || !isIntakeSiteUrl(href)) {
    return undefined
  }

  const cleanStableId = sanitizeStableId(stableId)
  const cleanEnvironmentTier = sanitizeEnvironmentTier(environmentTier)

  return {
    ...details,
    ...(cleanEnvironmentTier !== undefined && { environmentTier: cleanEnvironmentTier }),
    ...(cleanStableId && { stableId: cleanStableId }),
  }
}

const isReadable = (tab: TabLike): tab is TabLike & { id: number } => tab.id !== undefined && isIntakeSiteUrl(tab.url)

const readPage = async (tabId: number): Promise<UserDetails | undefined> => {
  try {
    const [result] = await browser.scripting.executeScript({
      func: getUserDetailsFromPage,
      target: { tabId },
      world: 'MAIN',
    })

    if (result?.result) {
      return sanitizePage(result.result)
    }
  } catch (error) {
    // Ignore error when accessing restricted URLs like about:blank
    if (error instanceof Error && error.message.includes('Cannot access contents of url "about:blank"')) {
      return undefined
    }
    console.error('Failed to get user details from page', handleApiError(error))
    return undefined
  }
  return undefined
}

export const getUserDetails = async (tab: TabLike): Promise<UserDetails | undefined> => {
  // REQ-SET-014: never read SDK state outside the Intake Site, whatever the caller checked.
  const details = isReadable(tab) ? await readPage(tab.id) : undefined
  return details
}
