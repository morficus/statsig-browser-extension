import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiKeyTypeStorage } from '@/src/lib/storage'

import { useSettingsStorage } from './use-settings-storage'

const clearProjects = vi.fn()
const setLocalStorageKey = vi.fn()
const setCurrentOverrides = vi.fn()
const useWxtStorage = vi.fn()
const useSettingsStore = vi.fn()

vi.mock('@/src/hooks/use-wxt-storage', () => ({
  useWxtStorage: (...args: unknown[]) => useWxtStorage(...args),
}))

vi.mock('@/src/store/use-settings-store', () => ({
  useSettingsStore: () => useSettingsStore(),
}))

describe('useSettingsStorage', () => {
  beforeEach(() => {
    clearProjects.mockReset()
    setLocalStorageKey.mockReset()
    setCurrentOverrides.mockReset()
    useSettingsStore.mockReturnValue({
      activeProjectId: 'p1',
      apiKey: 'console-key',
      clearProjects,
      isApiKeyLoading: false,
      projects: [],
    })
    useWxtStorage
      .mockReset()
      .mockReturnValueOnce(['statsig_user', setLocalStorageKey, false])
      .mockReturnValueOnce([[], setCurrentOverrides, false])
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

  it('reset clears the projects, local storage key, and overrides', async () => {
    const { result } = renderHook(() => useSettingsStorage())

    await act(async () => {
      await result.current.reset()
    })

    expect(clearProjects).toHaveBeenCalledWith()
    expect(setLocalStorageKey).toHaveBeenCalledWith('statsig_user')
    expect(setCurrentOverrides).toHaveBeenCalledWith([])
  })
})
