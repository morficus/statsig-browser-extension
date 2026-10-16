import { storage } from 'wxt/utils/storage'

import type { OverrideRecord } from '@/src/lib/override-record'
import type { ApiKeyType, StatsigProject } from '@/src/lib/projects'

/**
 * Console API key of the active project. Derived from {@link projectsStorage} plus
 * {@link activeProjectIdStorage}; the background script reads it to authorize API requests.
 */
export const apiKeyStorage = storage.defineItem<string>('local:statsig-console-api-key', {
  fallback: '',
})

export const projectsStorage = storage.defineItem<StatsigProject[]>('local:statsig-projects', {
  fallback: [],
})

export const activeProjectIdStorage = storage.defineItem<string>('local:statsig-active-project-id', {
  fallback: '',
})

export const localStorageKeyStorage = storage.defineItem<string>('local:statsig-local-storage-key', {
  fallback: 'statsig_user',
})

export const apiKeyTypeStorage = storage.defineItem<ApiKeyType>('local:api_key_type', {
  fallback: 'write-key',
})

/** Overrides that the Tester set with this extension (REQ-OVR-012). Extension storage only (REQ-SEC-002). */
export const overrideRecordsStorage = storage.defineItem<OverrideRecord[]>('local:statsig-override-records', {
  fallback: [],
})

export const themeStorage = storage.defineItem<'light' | 'dark' | 'system'>('local:theme', {
  fallback: 'system',
})
