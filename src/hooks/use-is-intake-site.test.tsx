import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
      expect(result.current).toBeFalsy()
    })
  })
})
