import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useContextStore } from '@/src/store/use-context-store'

import { useIsIntakeSite } from './use-is-intake-site'

const { getActiveIntakeTabMock } = vi.hoisted(() => ({
  getActiveIntakeTabMock: vi.fn(),
}))

vi.mock('@/src/lib/tabs', () => ({
  getActiveIntakeTab: getActiveIntakeTabMock,
}))

describe('useIsIntakeSite', () => {
  beforeEach(() => {
    getActiveIntakeTabMock.mockReset()
    useContextStore.setState({ isIntakeSite: undefined })
  })

  it('is undefined first, then true for an Intake Site tab', async () => {
    getActiveIntakeTabMock.mockResolvedValue({ id: 1, url: 'https://app.staging.talkiatry.com/assessment' })

    const { result } = renderHook(() => useIsIntakeSite())
    expect(result.current).toBeUndefined()

    await waitFor(() => {
      expect(result.current).toBeTruthy()
    })
  })

  it('is false when the tab is not an Intake Site page or there is no tab', async () => {
    getActiveIntakeTabMock.mockResolvedValue(null)

    const { result } = renderHook(() => useIsIntakeSite())

    await waitFor(() => {
      expect(result.current).toBeDefined()
      expect(result.current).toBeFalsy()
    })
  })

  it('writes the result to the context store, which holds the same value as the hook', async () => {
    getActiveIntakeTabMock.mockResolvedValue({ id: 1, url: 'https://app.staging.talkiatry.com/assessment' })

    const { result } = renderHook(() => useIsIntakeSite())

    await waitFor(() => {
      expect(result.current).toBeDefined()
    })
    expect(useContextStore.getState().isIntakeSite).toStrictEqual(result.current)
    expect(useContextStore.getState().isIntakeSite).toBeTruthy()
  })
})
