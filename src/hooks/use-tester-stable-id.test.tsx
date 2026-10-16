import type { ReactNode } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { storage } from 'wxt/utils/storage'

import { getManualStableId, saveManualStableId } from '@/src/lib/manual-stable-id'

import { useTesterStableId } from './use-tester-stable-id'

const { getActiveIntakeTabMock, getUserDetailsMock } = vi.hoisted(() => ({
  getActiveIntakeTabMock: vi.fn(),
  getUserDetailsMock: vi.fn(),
}))

vi.mock('@/src/lib/tabs', () => ({
  getActiveIntakeTab: getActiveIntakeTabMock,
}))

vi.mock('../handlers/get-user-details', () => ({
  getUserDetails: getUserDetailsMock,
}))

const STAGING = 'https://app.staging.talkiatry.com'
const PRODUCTION = 'https://app.talkiatry.com'
const stagingTab = { id: 42, url: `${STAGING}/assessment` }
const productionTab = { id: 43, url: `${PRODUCTION}/assessment` }

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: Readonly<{ children: ReactNode }>) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { queryClient, wrapper }
}

const renderUseTesterStableId = () => {
  const { queryClient, wrapper } = createWrapper()
  return { queryClient, ...renderHook(() => useTesterStableId(), { wrapper }) }
}

/** Renders the hook and records what every committed render returned, tagged with the current phase. */
const renderRecording = () => {
  const { queryClient, wrapper } = createWrapper()
  const phase = { current: 'start' }
  const renders: { isLoading: boolean; isRefetching: boolean; phase: string; stableId?: string }[] = []
  const hook = renderHook(
    () => {
      const state = useTesterStableId()
      useEffect(() => {
        renders.push({
          isLoading: state.isLoading,
          isRefetching: state.isRefetching,
          phase: phase.current,
          stableId: state.stableId,
        })
      })
      return state
    },
    { wrapper },
  )
  return { ...hook, phase, queryClient, renders }
}

/** Lets a read that was cancelled or overwritten show up in the cache, if it is going to. */
const flushReads = () =>
  act(async () => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 20)
    })
  })

/** Holds every storage read until the promise settles, so the typed-in ID read stays pending. */
const holdStorageRead = (pending: Promise<unknown>) => vi.spyOn(storage, 'getItem').mockReturnValue(pending)

const waitForRead = async (result: { current: { isLoading: boolean } }) => {
  await waitFor(() => {
    expect(result.current.isLoading).toBeFalsy()
  })
}

describe('useTesterStableId', () => {
  beforeEach(() => {
    fakeBrowser.reset()
    getActiveIntakeTabMock.mockReset()
    getUserDetailsMock.mockReset()
    getActiveIntakeTabMock.mockResolvedValue(stagingTab)
  })

  describe('detected Stable ID', () => {
    it('is loading until the page read finishes', async () => {
      getUserDetailsMock.mockResolvedValue({ stableId: { source: 'sdk', value: 'sdk-id' }, user: {} })

      const { result } = renderUseTesterStableId()

      expect(result.current.isLoading).toBeTruthy()
      expect(result.current.isMissing).toBeFalsy()
      expect(result.current.stableId).toBeUndefined()

      await waitForRead(result)
    })

    it('stays loading while the typed-in ID read runs and no ID is detected', async () => {
      const pending = Promise.withResolvers<unknown>()
      const storageRead = holdStorageRead(pending.promise)
      getUserDetailsMock.mockResolvedValue({ user: {} })

      const { result } = renderUseTesterStableId()
      await waitFor(() => {
        expect(storageRead).toHaveBeenCalled()
      })

      expect(result.current.isLoading).toBeTruthy()
      expect(result.current.stableId).toBeUndefined()

      pending.resolve('typed-id')
      await waitForRead(result)

      expect(result.current.stableId).toBe('typed-id')
      expect(result.current.source).toBe('manual')
    })

    it('does not wait for the typed-in ID read when an ID is detected', async () => {
      const pending = Promise.withResolvers<unknown>()
      const storageRead = holdStorageRead(pending.promise)
      getUserDetailsMock.mockResolvedValue({ stableId: { source: 'sdk', value: 'sdk-id' }, user: {} })

      const { result } = renderUseTesterStableId()
      await waitFor(() => {
        expect(storageRead).toHaveBeenCalled()
      })

      expect(result.current.isLoading).toBeFalsy()
      expect(result.current.stableId).toBe('sdk-id')
      expect(result.current.source).toBe('sdk')

      pending.resolve(null)
    })

    it('uses the SDK Stable ID', async () => {
      getUserDetailsMock.mockResolvedValue({ stableId: { source: 'sdk', value: 'sdk-id' }, user: {} })

      const { result } = renderUseTesterStableId()
      await waitForRead(result)

      expect(result.current.stableId).toBe('sdk-id')
      expect(result.current.source).toBe('sdk')
      expect(result.current.isMissing).toBeFalsy()
      expect(getUserDetailsMock).toHaveBeenCalledWith(stagingTab)
    })

    it('uses the localStorage Stable ID', async () => {
      getUserDetailsMock.mockResolvedValue({ stableId: { source: 'localStorage', value: 'ls-id' }, user: {} })

      const { result } = renderUseTesterStableId()
      await waitForRead(result)

      expect(result.current.stableId).toBe('ls-id')
      expect(result.current.source).toBe('localStorage')
      expect(result.current.isMissing).toBeFalsy()
    })

    it('prefers a detected ID over a typed-in ID and keeps the typed-in ID stored', async () => {
      await saveManualStableId(STAGING, 'typed-id')
      getUserDetailsMock.mockResolvedValue({ stableId: { source: 'sdk', value: 'sdk-id' }, user: {} })

      const { result } = renderUseTesterStableId()
      await waitFor(() => {
        expect(result.current.manualStableId).toBe('typed-id')
      })

      expect(result.current.stableId).toBe('sdk-id')
      expect(result.current.source).toBe('sdk')
      await expect(getManualStableId(STAGING)).resolves.toBe('typed-id')
    })

    it('passes the SDK tier through', async () => {
      getUserDetailsMock.mockResolvedValue({
        environmentTier: 'staging',
        stableId: { source: 'sdk', value: 'sdk-id' },
        user: {},
      })

      const { result } = renderUseTesterStableId()
      await waitForRead(result)

      expect(result.current.environmentTier).toBe('staging')
    })

    it('leaves the tier undefined when the SDK reports none', async () => {
      getUserDetailsMock.mockResolvedValue({ stableId: { source: 'sdk', value: 'sdk-id' }, user: {} })

      const { result } = renderUseTesterStableId()
      await waitForRead(result)

      expect(result.current.environmentTier).toBeUndefined()
    })
  })

  describe('no detected Stable ID', () => {
    it('is missing when the read finds nothing', async () => {
      getUserDetailsMock.mockResolvedValue({ user: {} })

      const { result } = renderUseTesterStableId()
      await waitForRead(result)

      expect(result.current.isMissing).toBeTruthy()
      expect(result.current.stableId).toBeUndefined()
      expect(result.current.source).toBeUndefined()
      expect(result.current.manualStableId).toBeUndefined()
    })

    it('is missing when the handler returns undefined', async () => {
      // oxlint-disable-next-line unicorn/no-useless-undefined
      getUserDetailsMock.mockResolvedValue(undefined)

      const { result } = renderUseTesterStableId()
      await waitForRead(result)

      expect(result.current.isMissing).toBeTruthy()
      expect(result.current.stableId).toBeUndefined()
    })

    it('is missing when the read throws, and still lets the Tester type an ID in', async () => {
      getUserDetailsMock.mockRejectedValue(new Error('read blocked'))

      const { result } = renderUseTesterStableId()
      await waitForRead(result)

      expect(result.current.isMissing).toBeTruthy()
      expect(result.current.stableId).toBeUndefined()

      await act(async () => {
        await result.current.saveManualStableId('typed-id')
      })

      await waitFor(() => {
        expect(result.current.stableId).toBe('typed-id')
      })
      expect(result.current.source).toBe('manual')
      await expect(getManualStableId(STAGING)).resolves.toBe('typed-id')
    })

    it('uses the typed-in ID with source manual when the read finds nothing (T-OVR-6)', async () => {
      await saveManualStableId(STAGING, 'typed-id')
      getUserDetailsMock.mockResolvedValue({ user: {} })

      const { result } = renderUseTesterStableId()
      await waitFor(() => {
        expect(result.current.stableId).toBe('typed-id')
      })

      expect(result.current.source).toBe('manual')
      expect(result.current.manualStableId).toBe('typed-id')
      expect(result.current.isMissing).toBeTruthy()
    })

    it('does not use a typed-in ID stored for another origin', async () => {
      await saveManualStableId(PRODUCTION, 'production-id')
      getUserDetailsMock.mockResolvedValue({ user: {} })

      const { queryClient, result } = renderUseTesterStableId()
      await waitForRead(result)
      await waitFor(() => {
        expect(queryClient.getQueryData(['tester-stable-id', 'manual', STAGING])).toBeNull()
      })

      expect(result.current.manualStableId).toBeUndefined()
      expect(result.current.stableId).toBeUndefined()
    })

    it('passes the SDK tier through even when the ID is missing', async () => {
      getUserDetailsMock.mockResolvedValue({ environmentTier: 'production', user: {} })

      const { result } = renderUseTesterStableId()
      await waitForRead(result)

      expect(result.current.environmentTier).toBe('production')
    })
  })

  describe('no Intake Site tab', () => {
    beforeEach(() => {
      getActiveIntakeTabMock.mockResolvedValue(null)
    })

    it('is not missing and has no ID', async () => {
      const { result } = renderUseTesterStableId()
      await waitForRead(result)

      expect(result.current.isMissing).toBeFalsy()
      expect(result.current.stableId).toBeUndefined()
      expect(result.current.source).toBeUndefined()
      expect(result.current.manualStableId).toBeUndefined()
      expect(getUserDetailsMock).not.toHaveBeenCalled()
    })

    it('rejects save and clear, and stores nothing', async () => {
      const { result } = renderUseTesterStableId()
      await waitForRead(result)

      await expect(result.current.saveManualStableId('typed-id')).rejects.toThrow(Error)
      await expect(result.current.clearManualStableId()).rejects.toThrow(Error)
      await expect(fakeBrowser.storage.session.get(null)).resolves.toStrictEqual({})
    })
  })

  describe('typed-in ID', () => {
    beforeEach(() => {
      getUserDetailsMock.mockResolvedValue({ user: {} })
    })

    it('saves the trimmed value to session storage for the tab origin', async () => {
      const { result } = renderUseTesterStableId()
      await waitForRead(result)

      await act(async () => {
        await result.current.saveManualStableId('  typed-id  ')
      })

      await waitFor(() => {
        expect(result.current.manualStableId).toBe('typed-id')
      })
      await expect(getManualStableId(STAGING)).resolves.toBe('typed-id')
      await expect(getManualStableId(PRODUCTION)).resolves.toBeUndefined()
    })

    it('rejects an invalid value and keeps the state', async () => {
      const { result } = renderUseTesterStableId()
      await waitForRead(result)

      await expect(result.current.saveManualStableId('bad value')).rejects.toThrow(Error)

      expect(result.current.manualStableId).toBeUndefined()
      await expect(getManualStableId(STAGING)).resolves.toBeUndefined()
    })

    it('clears the stored value', async () => {
      await saveManualStableId(STAGING, 'typed-id')

      const { result } = renderUseTesterStableId()
      await waitFor(() => {
        expect(result.current.manualStableId).toBe('typed-id')
      })

      await act(async () => {
        await result.current.clearManualStableId()
      })

      await waitFor(() => {
        expect(result.current.manualStableId).toBeUndefined()
      })
      expect(result.current.stableId).toBeUndefined()
      await expect(getManualStableId(STAGING)).resolves.toBeUndefined()
    })

    it('shares a saved and a cleared ID with a second hook instance on the same QueryClient', async () => {
      const { wrapper } = createWrapper()
      const first = renderHook(() => useTesterStableId(), { wrapper })
      const second = renderHook(() => useTesterStableId(), { wrapper })
      await waitForRead(first.result)
      await waitForRead(second.result)

      await act(async () => {
        await first.result.current.saveManualStableId('typed-id')
      })

      await waitFor(() => {
        expect(first.result.current.stableId).toBe('typed-id')
        expect(second.result.current.stableId).toBe('typed-id')
      })
      expect(second.result.current.source).toBe('manual')
      expect(second.result.current.manualStableId).toBe('typed-id')

      await act(async () => {
        await second.result.current.clearManualStableId()
      })

      await waitFor(() => {
        expect(first.result.current.manualStableId).toBeUndefined()
        expect(second.result.current.manualStableId).toBeUndefined()
      })
      expect(first.result.current.stableId).toBeUndefined()
    })
  })

  describe('refetch', () => {
    it('reads the page again', async () => {
      getUserDetailsMock.mockResolvedValueOnce({ user: {} })
      getUserDetailsMock.mockResolvedValueOnce({ stableId: { source: 'localStorage', value: 'ls-id' }, user: {} })

      const { result } = renderUseTesterStableId()
      await waitForRead(result)
      expect(result.current.isMissing).toBeTruthy()
      expect(getUserDetailsMock).toHaveBeenCalledTimes(1)

      await act(async () => {
        await result.current.refetch()
      })

      expect(getUserDetailsMock).toHaveBeenCalledTimes(2)
      await waitFor(() => {
        expect(result.current.stableId).toBe('ls-id')
      })
      expect(result.current.source).toBe('localStorage')
      expect(result.current.isMissing).toBeFalsy()
    })

    it('reports isRefetching while the page read runs again', async () => {
      const pending = Promise.withResolvers<unknown>()
      getUserDetailsMock.mockResolvedValueOnce({ user: {} })
      getUserDetailsMock.mockReturnValueOnce(pending.promise)

      const { result } = renderUseTesterStableId()
      await waitForRead(result)
      expect(result.current.isRefetching).toBeFalsy()

      const refetching = result.current.refetch()

      await waitFor(() => {
        expect(result.current.isRefetching).toBeTruthy()
      })
      expect(result.current.isLoading).toBeFalsy()

      pending.resolve({ user: {} })
      await refetching

      await waitFor(() => {
        expect(result.current.isRefetching).toBeFalsy()
      })
    })

    it('keeps the typed-in ID in use when the read finds nothing again', async () => {
      await saveManualStableId(STAGING, 'typed-id')
      getUserDetailsMock.mockResolvedValue({ user: {} })

      const { result } = renderUseTesterStableId()
      await waitFor(() => {
        expect(result.current.stableId).toBe('typed-id')
      })

      await act(async () => {
        await result.current.refetch()
      })

      expect(result.current.stableId).toBe('typed-id')
      expect(result.current.source).toBe('manual')
    })
  })

  describe('a typed-in ID read that is already running', () => {
    beforeEach(() => {
      getUserDetailsMock.mockResolvedValue({ user: {} })
    })

    it('does not put a cleared ID back when it finishes after Clear', async () => {
      await saveManualStableId(STAGING, 'typed-id')
      const { queryClient, result } = renderUseTesterStableId()
      await waitFor(() => {
        expect(result.current.stableId).toBe('typed-id')
      })

      // The next storage read would return the value from before the Clear.
      const held = Promise.withResolvers<unknown>()
      const storageRead = vi.spyOn(storage, 'getItem').mockReturnValueOnce(held.promise)
      act(() => {
        void queryClient.invalidateQueries()
      })
      await waitFor(() => {
        expect(storageRead).toHaveBeenCalled()
      })

      await act(async () => {
        await result.current.clearManualStableId()
      })
      await waitFor(() => {
        expect(result.current.stableId).toBeUndefined()
      })

      held.resolve('typed-id')
      await flushReads()

      expect(result.current.stableId).toBeUndefined()
      expect(result.current.source).toBeUndefined()
      expect(result.current.manualStableId).toBeUndefined()
      await expect(getManualStableId(STAGING)).resolves.toBeUndefined()
    })

    it('does not drop a saved ID when it finishes after Save', async () => {
      const { queryClient, result } = renderUseTesterStableId()
      await waitForRead(result)

      // The next storage read would return the value from before the Save.
      const held = Promise.withResolvers<unknown>()
      const storageRead = vi.spyOn(storage, 'getItem').mockReturnValueOnce(held.promise)
      act(() => {
        void queryClient.invalidateQueries()
      })
      await waitFor(() => {
        expect(storageRead).toHaveBeenCalled()
      })

      await act(async () => {
        await result.current.saveManualStableId('typed-id')
      })
      await waitFor(() => {
        expect(result.current.stableId).toBe('typed-id')
      })

      held.resolve(null)
      await flushReads()

      expect(result.current.stableId).toBe('typed-id')
      expect(result.current.source).toBe('manual')
      await expect(getManualStableId(STAGING)).resolves.toBe('typed-id')
    })
  })

  describe('the active tab changes to another origin (REQ-OVR-009)', () => {
    it('never uses the typed-in ID of the old origin, and stays loading until the new origin read lands', async () => {
      getUserDetailsMock.mockResolvedValue({ user: {} })
      const { phase, renders, result } = renderRecording()
      await waitForRead(result)
      await act(async () => {
        await result.current.saveManualStableId('staging-id')
      })
      await waitFor(() => {
        expect(result.current.stableId).toBe('staging-id')
      })

      // The Tester moves to production. The typed-in ID read for production does not finish yet.
      const pending = Promise.withResolvers<unknown>()
      const storageRead = holdStorageRead(pending.promise)
      getActiveIntakeTabMock.mockResolvedValue(productionTab)
      phase.current = 'switched'
      await act(async () => {
        await result.current.refetch()
      })
      await waitFor(() => {
        expect(storageRead).toHaveBeenCalled()
      })

      expect(result.current.isLoading).toBeTruthy()
      expect(result.current.stableId).toBeUndefined()

      phase.current = 'landed'
      pending.resolve(null)
      await waitForRead(result)

      // A render during the refetch may still show the old page. F07 must not force while isRefetching.
      const settled = renders.filter((render) => render.phase !== 'start').filter((render) => !render.isRefetching)
      const beforeReadLands = settled.filter((render) => render.phase === 'switched')
      expect(beforeReadLands.length).toBeGreaterThan(0)
      expect(settled.filter((render) => render.stableId === 'staging-id')).toStrictEqual([])
      expect(beforeReadLands.filter((render) => !render.isLoading)).toStrictEqual([])
      expect(result.current.stableId).toBeUndefined()
      expect(result.current.isMissing).toBeTruthy()
    })
  })
})
