import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import type { OverrideRecord } from '@/src/lib/override-record'

import { apiKeyTypeStorage, localStorageKeyStorage, overrideRecordsStorage } from '@/src/lib/storage'

import { useSettingsStorage } from './use-settings-storage'

const clearProjects = vi.fn()
const setLocalStorageKey = vi.fn()
const useWxtStorage = vi.fn()
const useSettingsStore = vi.fn()

const record: OverrideRecord = {
  createdAt: 1_700_000_000_000,
  environment: 'staging',
  experimentId: 'intake_copy_test',
  experimentName: 'Intake copy test',
  groupName: 'Control',
  stableId: 'stable-1',
}

vi.mock('@/src/hooks/use-wxt-storage', () => ({
  useWxtStorage: (...args: unknown[]) => useWxtStorage(...args),
}))

vi.mock('@/src/store/use-settings-store', () => ({
  useSettingsStore: () => useSettingsStore(),
}))

describe('useSettingsStorage', () => {
  beforeEach(() => {
    fakeBrowser.reset()
    clearProjects.mockReset()
    setLocalStorageKey.mockReset()
    useSettingsStore.mockReturnValue({
      activeProjectId: 'p1',
      apiKey: 'console-key',
      clearProjects,
      isApiKeyLoading: false,
      projects: [],
    })
    useWxtStorage.mockReset().mockReturnValueOnce(['statsig_user', setLocalStorageKey, false])
  })

  it('returns stored settings', () => {
    const { result } = renderHook(() => useSettingsStorage())

    expect(result.current.apiKey).toBe('console-key')
    expect(result.current.localStorageValue).toBe('statsig_user')
  })

  it('leaves the stored API key type alone, so a read-key is no longer overwritten', async () => {
    await apiKeyTypeStorage.setValue('read-key')

    renderHook(() => useSettingsStorage())

    await expect(apiKeyTypeStorage.getValue()).resolves.toBe('read-key')
    expect(useWxtStorage).not.toHaveBeenCalledWith(apiKeyTypeStorage)
  })

  it('reset clears the projects, local storage key, and override records', async () => {
    const { result } = renderHook(() => useSettingsStorage())

    await act(async () => {
      await result.current.reset()
    })

    expect(clearProjects).toHaveBeenCalledWith()
    expect(setLocalStorageKey).toHaveBeenCalledWith('statsig_user')
  })

  it('reset writes an empty list to the override records storage', async () => {
    await overrideRecordsStorage.setValue([record])
    const setValue = vi.spyOn(overrideRecordsStorage, 'setValue')
    const { result } = renderHook(() => useSettingsStorage())

    await act(async () => {
      await result.current.reset()
    })

    expect(setValue).toHaveBeenCalledExactlyOnceWith([])
    await expect(overrideRecordsStorage.getValue()).resolves.toStrictEqual([])
  })

  it('does not subscribe to the override records', () => {
    renderHook(() => useSettingsStorage())

    expect(useWxtStorage).toHaveBeenCalledExactlyOnceWith(localStorageKeyStorage)
    expect(useWxtStorage).not.toHaveBeenCalledWith(overrideRecordsStorage)
  })
})
