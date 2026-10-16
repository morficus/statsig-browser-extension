import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useDetectedUser } from './use-detected-user'

interface TestSender {
  tab?: { id?: number; url?: string }
}

type MessageListener = (message: unknown, sender: TestSender) => unknown

const {
  browserMock,
  getActiveIntakeTabMock,
  setDetectedContextMock,
  setDetectedUserMock,
  setDetectionErrorMock,
  listeners,
} = vi.hoisted(() => {
  const listenersArray: MessageListener[] = []
  return {
    browserMock: {
      runtime: {
        onMessage: {
          addListener: vi.fn((cb: MessageListener) => {
            listenersArray.push(cb)
          }),
          removeListener: vi.fn((cb: MessageListener) => {
            const i = listenersArray.indexOf(cb)
            if (i !== -1) {
              listenersArray.splice(i, 1)
            }
          }),
        },
      },
      tabs: {
        sendMessage: vi.fn(),
      },
    },
    getActiveIntakeTabMock: vi.fn(),
    listeners: listenersArray,
    setDetectedContextMock: vi.fn(),
    setDetectedUserMock: vi.fn(),
    setDetectionErrorMock: vi.fn(),
  }
})

vi.mock('wxt/browser', () => ({
  browser: browserMock,
}))

vi.mock('@/src/lib/tabs', () => ({
  getActiveIntakeTab: getActiveIntakeTabMock,
}))

vi.mock('@/src/store/use-context-store', () => ({
  useContextStore: (selector: (state: unknown) => unknown) =>
    selector({
      setDetectedContext: setDetectedContextMock,
      setDetectedUser: setDetectedUserMock,
      setDetectionError: setDetectionErrorMock,
    }),
}))

const INTAKE_URL = 'https://app.staging.talkiatry.com/assessment'

const ACTIVE_TAB_ID = 5

const USER_FOUND = {
  context: { stableID: 's1' },
  type: 'STATSIG_USER_FOUND',
  user: { userID: 'u_msg' },
}
const DETECTED_BUT_ERROR = { error: 'page broken', type: 'STATSIG_DETECTED_BUT_ERROR' }

// The tests run on fake timers: advancing them also settles every pending microtask, so the listener's async work is done.
const flush = () => vi.advanceTimersByTimeAsync(0)

// Mounts the hook, waits for the mount-time fetch, then clears the mocks so the tests see only the listener's calls.
const mountHook = async () => {
  const { unmount } = renderHook(() => useDetectedUser())
  await vi.waitFor(() => {
    expect(listeners).toHaveLength(1)
    expect(browserMock.tabs.sendMessage).toHaveBeenCalledTimes(1)
  })
  await flush()
  getActiveIntakeTabMock.mockClear()
  setDetectedUserMock.mockClear()
  setDetectedContextMock.mockClear()
  setDetectionErrorMock.mockClear()
  return { listener: listeners[0], unmount }
}

const mountAndGetListener = async () => {
  const { listener } = await mountHook()
  return listener
}

// Every store write the hook made, in one list, so a test can assert that there was none
const storeWrites = () => [
  ...setDetectedUserMock.mock.calls,
  ...setDetectedContextMock.mock.calls,
  ...setDetectionErrorMock.mock.calls,
]

describe('useDetectedUser', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    setDetectedUserMock.mockReset()
    setDetectedContextMock.mockReset()
    setDetectionErrorMock.mockReset()
    getActiveIntakeTabMock.mockReset()
    browserMock.tabs.sendMessage.mockReset()
    browserMock.runtime.onMessage.addListener.mockClear()
    browserMock.runtime.onMessage.removeListener.mockClear()
    listeners.length = 0
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('writes user and context to the store after fetching from the active tab', async () => {
    getActiveIntakeTabMock.mockResolvedValue({ id: 5, url: INTAKE_URL })
    browserMock.tabs.sendMessage.mockResolvedValue({ context: { app: 'web' }, user: { userID: 'u1' } })

    renderHook(() => useDetectedUser())

    await vi.waitFor(() => {
      expect(setDetectedUserMock).toHaveBeenCalledWith({ userID: 'u1' })
    })
    expect(setDetectedContextMock).toHaveBeenCalledWith({ app: 'web' })
    expect(setDetectionErrorMock).toHaveBeenCalledWith(null)
  })

  it('does not call setDetectedUser when there is no Intake Site tab', async () => {
    getActiveIntakeTabMock.mockResolvedValue(null)
    renderHook(() => useDetectedUser())

    await vi.waitFor(() => {
      expect(getActiveIntakeTabMock).toHaveBeenCalledWith()
    })
    expect(browserMock.tabs.sendMessage).not.toHaveBeenCalled()
    expect(setDetectedUserMock).not.toHaveBeenCalled()
  })

  it('handles STATSIG_USER_FOUND runtime messages', async () => {
    getActiveIntakeTabMock.mockResolvedValue({ id: 1, url: INTAKE_URL })
    browserMock.tabs.sendMessage.mockResolvedValue({})

    renderHook(() => useDetectedUser())

    await vi.waitFor(() => {
      expect(listeners.length).toBeGreaterThan(0)
    })

    act(() => {
      listeners[0](
        {
          context: { stableID: 's1' },
          type: 'STATSIG_USER_FOUND',
          user: { userID: 'u_msg' },
        },
        { tab: { id: 1, url: INTAKE_URL } },
      )
    })

    await vi.waitFor(() => {
      expect(setDetectedUserMock).toHaveBeenCalledWith({ userID: 'u_msg' })
    })
    expect(setDetectedContextMock).toHaveBeenCalledWith({ stableID: 's1' })
    expect(setDetectionErrorMock).toHaveBeenLastCalledWith(null)
  })

  it('handles STATSIG_DETECTED_BUT_ERROR runtime messages', async () => {
    getActiveIntakeTabMock.mockResolvedValue({ id: 1, url: INTAKE_URL })
    browserMock.tabs.sendMessage.mockResolvedValue({})

    renderHook(() => useDetectedUser())

    await vi.waitFor(() => {
      expect(listeners.length).toBeGreaterThan(0)
    })

    act(() => {
      listeners[0]({ error: 'page broken', type: 'STATSIG_DETECTED_BUT_ERROR' }, { tab: { id: 1, url: INTAKE_URL } })
    })

    await vi.waitFor(() => {
      expect(setDetectionErrorMock).toHaveBeenCalledWith('page broken')
    })
    expect(setDetectedUserMock).not.toHaveBeenCalled()
  })

  it('ignores malformed runtime messages', async () => {
    getActiveIntakeTabMock.mockResolvedValue({ id: 1, url: INTAKE_URL })
    browserMock.tabs.sendMessage.mockResolvedValue({})

    renderHook(() => useDetectedUser())

    await vi.waitFor(() => {
      expect(listeners.length).toBeGreaterThan(0)
    })

    act(() => {
      listeners[0]('not an object', { tab: { id: 1, url: INTAKE_URL } })
      listeners[0]({ no_type: true }, { tab: { id: 1, url: INTAKE_URL } })
    })

    expect(setDetectedUserMock).not.toHaveBeenCalled()
    expect(setDetectionErrorMock).not.toHaveBeenCalledWith(expect.any(String))
  })

  it('removes the message listener on unmount', async () => {
    getActiveIntakeTabMock.mockResolvedValue({ id: 1, url: INTAKE_URL })
    browserMock.tabs.sendMessage.mockResolvedValue({})

    const { unmount } = renderHook(() => useDetectedUser())

    await vi.waitFor(() => {
      expect(listeners).toHaveLength(1)
    })

    unmount()
    expect(listeners).toHaveLength(0)
  })

  it('retryDetection sends a message and writes detected user on success', async () => {
    getActiveIntakeTabMock.mockResolvedValue({ id: 3, url: INTAKE_URL })
    browserMock.tabs.sendMessage.mockResolvedValueOnce({}).mockResolvedValueOnce({ user: { userID: 'retry_u' } })

    const { result } = renderHook(() => useDetectedUser())

    await vi.waitFor(() => {
      expect(getActiveIntakeTabMock).toHaveBeenCalledWith()
    })

    await act(async () => {
      await result.current.retryDetection()
    })

    expect(setDetectedUserMock).toHaveBeenCalledWith({ userID: 'retry_u' })
    expect(setDetectionErrorMock).toHaveBeenCalledWith(null)
  })

  it('retryDetection keeps the current error until the page answers', async () => {
    getActiveIntakeTabMock.mockResolvedValue({ id: 3, url: INTAKE_URL })
    browserMock.tabs.sendMessage.mockResolvedValueOnce({}).mockResolvedValueOnce({ error: 'still broken' })

    const { result } = renderHook(() => useDetectedUser())

    await vi.waitFor(() => {
      expect(browserMock.tabs.sendMessage).toHaveBeenCalledTimes(1)
    })
    setDetectionErrorMock.mockClear()

    await act(async () => {
      await result.current.retryDetection()
    })

    expect(setDetectionErrorMock).not.toHaveBeenCalledWith(null)
    expect(setDetectionErrorMock).toHaveBeenLastCalledWith('still broken')
  })

  it('retryDetection writes a detection error if sending the message fails', async () => {
    getActiveIntakeTabMock
      .mockResolvedValueOnce({ id: 3, url: INTAKE_URL })
      .mockResolvedValueOnce({ id: 3, url: INTAKE_URL })
    browserMock.tabs.sendMessage.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('disconnected'))

    const { result } = renderHook(() => useDetectedUser())

    await act(async () => {
      await result.current.retryDetection()
    })

    expect(setDetectionErrorMock).toHaveBeenCalledWith('Connection failed. Please refresh the page.')
  })

  it('retryDetection never logs a Console Key echoed by a messaging error (REQ-SEC-003)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    getActiveIntakeTabMock.mockResolvedValue({ id: 3 })
    browserMock.tabs.sendMessage
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('disconnected. Key: console-AbC123xyz456'))

    const { result } = renderHook(() => useDetectedUser())

    await act(async () => {
      await result.current.retryDetection()
    })

    expect(errorSpy).toHaveBeenCalledWith('Statsig detection error:', expect.any(String))
    expect(errorSpy.mock.calls.flat().map(String).join(' ')).not.toContain('console-AbC123xyz456')
  })

  it('fetchUser never logs a Console Key echoed by the final messaging error (REQ-SEC-003)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    getActiveIntakeTabMock.mockResolvedValue({ id: 3 })
    browserMock.tabs.sendMessage.mockRejectedValue(new Error('disconnected. Key: console-AbC123xyz456'))

    renderHook(() => useDetectedUser())

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })

    expect(errorSpy).toHaveBeenCalledWith('Statsig detection error:', expect.any(String))
    expect(errorSpy.mock.calls.flat().map(String).join(' ')).not.toContain('console-AbC123xyz456')
  })

  it('sends nothing, retries nothing and logs nothing on a non-Intake tab', async () => {
    getActiveIntakeTabMock.mockResolvedValue(null)
    const { result } = renderHook(() => useDetectedUser())

    await act(async () => {
      await result.current.retryDetection()
      await vi.advanceTimersByTimeAsync(5000)
    })

    expect(browserMock.tabs.sendMessage).not.toHaveBeenCalled()
    expect(setDetectedUserMock).not.toHaveBeenCalled()
    expect(setDetectionErrorMock).not.toHaveBeenCalled()
    expect(console.error).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  describe('runtime message listener', () => {
    beforeEach(() => {
      vi.spyOn(console, 'log').mockImplementation(() => {})
      getActiveIntakeTabMock.mockResolvedValue({ id: ACTIVE_TAB_ID, url: INTAKE_URL })
      browserMock.tabs.sendMessage.mockResolvedValue({})
    })

    it('sets the user and context and clears the error for STATSIG_USER_FOUND from the active Intake tab', async () => {
      const listener = await mountAndGetListener()

      listener(USER_FOUND, { tab: { id: ACTIVE_TAB_ID, url: INTAKE_URL } })

      await vi.waitFor(() => {
        expect(setDetectedUserMock).toHaveBeenCalledWith({ userID: 'u_msg' })
      })
      expect(setDetectedContextMock).toHaveBeenCalledWith({ stableID: 's1' })
      expect(setDetectionErrorMock).toHaveBeenLastCalledWith(null)
    })

    it('does not set the context when STATSIG_USER_FOUND carries none', async () => {
      const listener = await mountAndGetListener()

      listener(
        { type: 'STATSIG_USER_FOUND', user: { userID: 'u_msg' } },
        { tab: { id: ACTIVE_TAB_ID, url: INTAKE_URL } },
      )

      await vi.waitFor(() => {
        expect(setDetectedUserMock).toHaveBeenCalledWith({ userID: 'u_msg' })
      })
      expect(setDetectedContextMock).not.toHaveBeenCalled()
      expect(setDetectionErrorMock).toHaveBeenLastCalledWith(null)
    })

    it('sets the error for STATSIG_DETECTED_BUT_ERROR from the active Intake tab', async () => {
      const listener = await mountAndGetListener()

      listener(DETECTED_BUT_ERROR, { tab: { id: ACTIVE_TAB_ID, url: INTAKE_URL } })

      await vi.waitFor(() => {
        expect(setDetectionErrorMock).toHaveBeenCalledWith('page broken')
      })
      expect(setDetectedUserMock).not.toHaveBeenCalled()
      expect(setDetectedContextMock).not.toHaveBeenCalled()
    })

    it('returns nothing, so the runtime keeps no response channel open', async () => {
      const listener = await mountAndGetListener()

      const result = listener(USER_FOUND, { tab: { id: ACTIVE_TAB_ID, url: INTAKE_URL } })

      expect(result).toBeUndefined()
      await flush()
    })

    describe.each([
      ['STATSIG_USER_FOUND', USER_FOUND],
      ['STATSIG_DETECTED_BUT_ERROR', DETECTED_BUT_ERROR],
    ])('%s is ignored', (_type, message) => {
      it('without a sender tab', async () => {
        const listener = await mountAndGetListener()

        listener(message, {})
        await flush()

        expect(storeWrites()).toStrictEqual([])
      })

      it('without a sender tab id', async () => {
        const listener = await mountAndGetListener()

        listener(message, { tab: { url: INTAKE_URL } })
        await flush()

        expect(storeWrites()).toStrictEqual([])
      })

      it('from a tab that is not the active Intake tab', async () => {
        const listener = await mountAndGetListener()

        listener(message, { tab: { id: ACTIVE_TAB_ID + 1, url: INTAKE_URL } })
        await flush()

        expect(storeWrites()).toStrictEqual([])
      })

      it('from a non-Intake sender tab URL', async () => {
        const listener = await mountAndGetListener()

        listener(message, { tab: { id: ACTIVE_TAB_ID, url: 'https://example.com/' } })
        await flush()

        expect(storeWrites()).toStrictEqual([])
      })

      it('from a sender tab without a URL', async () => {
        const listener = await mountAndGetListener()

        listener(message, { tab: { id: ACTIVE_TAB_ID } })
        await flush()

        expect(storeWrites()).toStrictEqual([])
      })

      it.each([
        ['undefined', undefined],
        ['null', null],
      ])('when there is no active Intake tab (%s)', async (_label, noTab) => {
        const listener = await mountAndGetListener()
        getActiveIntakeTabMock.mockResolvedValue(noTab)

        listener(message, { tab: { id: ACTIVE_TAB_ID, url: INTAKE_URL } })
        await flush()

        expect(getActiveIntakeTabMock).toHaveBeenCalledTimes(1)
        expect(storeWrites()).toStrictEqual([])
      })

      it('without logging', async () => {
        const listener = await mountAndGetListener()

        listener(message, { tab: { id: ACTIVE_TAB_ID + 1, url: 'https://example.com/' } })
        await flush()

        expect(console.error).not.toHaveBeenCalled()
        expect(console.log).not.toHaveBeenCalled()
      })
    })

    it.each([
      ['STATSIG_USER_FOUND', USER_FOUND],
      ['STATSIG_DETECTED_BUT_ERROR', DETECTED_BUT_ERROR],
    ])('writes nothing for %s when the active tab lookup settles after the hook unmounts', async (_type, message) => {
      const { listener, unmount } = await mountHook()
      const lookup = Promise.withResolvers<{ id: number; url: string }>()
      getActiveIntakeTabMock.mockReturnValue(lookup.promise)

      listener(message, { tab: { id: ACTIVE_TAB_ID, url: INTAKE_URL } })
      await flush()
      expect(getActiveIntakeTabMock).toHaveBeenCalledTimes(1)

      unmount()
      lookup.resolve({ id: ACTIVE_TAB_ID, url: INTAKE_URL })
      await flush()

      expect(storeWrites()).toStrictEqual([])
    })

    it('does not look up the active tab for a message that does not parse', async () => {
      const listener = await mountAndGetListener()
      const sender = { tab: { id: ACTIVE_TAB_ID, url: INTAKE_URL } }

      listener('not an object', sender)
      listener({ no_type: true }, sender)
      listener(null, sender)
      await flush()

      expect(getActiveIntakeTabMock).not.toHaveBeenCalled()
      expect(storeWrites()).toStrictEqual([])
    })

    it('does not look up the active tab for a parsed message of another type', async () => {
      const listener = await mountAndGetListener()

      listener({ type: 'OTHER' }, { tab: { id: ACTIVE_TAB_ID, url: INTAKE_URL } })
      await flush()

      expect(getActiveIntakeTabMock).not.toHaveBeenCalled()
      expect(storeWrites()).toStrictEqual([])
    })
  })
})
