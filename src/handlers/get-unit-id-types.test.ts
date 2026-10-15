import { beforeEach, vi, describe, expect, it } from 'vitest'

import { fetcher } from '@/src/lib/fetcher'

import { getUnitIDTypes } from './get-unit-id-types'

vi.mock('@/src/lib/fetcher', () => ({
  fetcher: vi.fn(),
}))

describe('unit ID types handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns string IDs from the API plus the defaults', async () => {
    vi.mocked(fetcher).mockResolvedValue({
      data: ['accountID', 'deviceID'],
      message: 'ok',
    })

    await expect(getUnitIDTypes()).resolves.toStrictEqual(['accountID', 'deviceID', 'userID', 'stableID'])
  })

  it('normalizes object payloads to their names', async () => {
    vi.mocked(fetcher).mockResolvedValue({
      data: [
        { displayName: 'Account', name: 'accountID' },
        { description: 'Device identifier', name: 'deviceID' },
      ],
      message: 'ok',
    })

    await expect(getUnitIDTypes()).resolves.toStrictEqual(['accountID', 'deviceID', 'userID', 'stableID'])
  })

  it('falls back to defaults when the payload shape is unexpected', async () => {
    vi.mocked(fetcher).mockResolvedValue({
      data: {} as unknown as string[],
      message: 'ok',
    })

    await expect(getUnitIDTypes()).resolves.toStrictEqual(['userID', 'stableID'])
  })

  it('logs and returns defaults when the request fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.mocked(fetcher).mockRejectedValue(new Error('Network failed'))

    await expect(getUnitIDTypes()).resolves.toStrictEqual(['userID', 'stableID'])
    expect(errorSpy).toHaveBeenCalledWith('Failed to fetch unit ID types:', 'Network failed')
  })

  it('never logs the Console Key when the API error body echoes it (REQ-SEC-003)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const body =
      'This endpoint only accepts an active CONSOLE key, but an invalid key was sent. Key: console-AbC123xyz456'
    const wretchError = Object.assign(new Error(body), { response: { _data: body }, status: 429, text: body })

    vi.mocked(fetcher).mockRejectedValue(wretchError)

    await expect(getUnitIDTypes()).resolves.toStrictEqual(['userID', 'stableID'])
    expect(errorSpy.mock.calls.flat().map(String).join(' ')).not.toContain('console-AbC123xyz456')
    expect(errorSpy).toHaveBeenCalledWith('Failed to fetch unit ID types:', expect.any(String))
  })
})
