import { waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderHookWithProviders } from '@/src/tests/utils/TestUtils'

import { useUserDetails } from './use-user-details'

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

const renderUseUserDetails = () => renderHookWithProviders(() => useUserDetails())

describe('useUserDetails', () => {
  beforeEach(() => {
    getActiveIntakeTabMock.mockReset()
    getUserDetailsMock.mockReset()
  })

  it('returns the user from the active tab', async () => {
    const user = { userID: 'user-1' }
    getActiveIntakeTabMock.mockResolvedValue({ id: 42, url: 'https://app.staging.talkiatry.com/assessment' })
    getUserDetailsMock.mockResolvedValue({ user })

    const { result } = renderUseUserDetails()

    await waitFor(() => {
      expect(result.current.isSuccess).toBeTruthy()
    })

    expect(result.current.data).toStrictEqual(user)
    expect(getUserDetailsMock).toHaveBeenCalledWith({ id: 42, url: 'https://app.staging.talkiatry.com/assessment' })
  })

  it('returns an empty object when handler returns undefined', async () => {
    getActiveIntakeTabMock.mockResolvedValue({ id: 7, url: 'https://app.staging.talkiatry.com/assessment' })
    // oxlint-disable-next-line unicorn/no-useless-undefined
    getUserDetailsMock.mockResolvedValue(undefined)

    const { result } = renderUseUserDetails()

    await waitFor(() => {
      expect(result.current.isSuccess).toBeTruthy()
    })

    expect(result.current.data).toStrictEqual({})
  })

  it('returns an empty object when handler returns no user', async () => {
    getActiveIntakeTabMock.mockResolvedValue({ id: 9, url: 'https://app.staging.talkiatry.com/assessment' })
    getUserDetailsMock.mockResolvedValue({})

    const { result } = renderUseUserDetails()

    await waitFor(() => {
      expect(result.current.isSuccess).toBeTruthy()
    })

    expect(result.current.data).toStrictEqual({})
  })

  it('fails when no Intake Site tab is found', async () => {
    getActiveIntakeTabMock.mockResolvedValue(null)

    const { result } = renderUseUserDetails()

    await waitFor(() => {
      expect(result.current.isError).toBeTruthy()
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect((result.current.error as Error).message).toBe('No Intake Site tab found')
    expect(getUserDetailsMock).not.toHaveBeenCalled()
  })
})
