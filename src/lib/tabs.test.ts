import { beforeEach, vi, describe, expect, it } from 'vitest'

import { getActiveTab } from './tabs'

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}))

vi.mock(import('wxt/browser'), async (importOriginal) => ({
  ...(await importOriginal()),
  browser: {
    tabs: {
      query: queryMock,
    },
  } as any,
}))

describe('active tab lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the current window active tab when available', async () => {
    const tab = { id: 1, url: 'https://example.com' }
    queryMock.mockResolvedValueOnce([tab])

    await expect(getActiveTab()).resolves.toStrictEqual(tab)
    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(queryMock).toHaveBeenCalledWith({ active: true, currentWindow: true })
  })

  it('falls back to any active tab when the current window has none', async () => {
    const fallbackTab = { id: 2, url: 'https://fallback.com' }
    queryMock.mockResolvedValueOnce([])
    queryMock.mockResolvedValueOnce([fallbackTab])

    await expect(getActiveTab()).resolves.toStrictEqual(fallbackTab)
    expect(queryMock).toHaveBeenNthCalledWith(1, { active: true, currentWindow: true })
    expect(queryMock).toHaveBeenNthCalledWith(2, { active: true })
  })

  it('returns null when no active tabs are found', async () => {
    queryMock.mockResolvedValueOnce([])
    queryMock.mockResolvedValueOnce([])

    await expect(getActiveTab()).resolves.toBeNull()
  })

  it('logs and returns null when querying tabs fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('tabs.query failed')

    queryMock.mockRejectedValue(error)

    await expect(getActiveTab()).resolves.toBeNull()
    expect(errorSpy).toHaveBeenCalledWith('[Intake Experiment Testing] Failed to get active tab:', 'tabs.query failed')
  })

  it('never logs a Console Key echoed by a tabs error (REQ-SEC-003)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    queryMock.mockRejectedValue(new Error('failed. Key: console-AbC123xyz456'))

    await expect(getActiveTab()).resolves.toBeNull()
    expect(errorSpy.mock.calls.flat().map(String).join(' ')).not.toContain('console-AbC123xyz456')
    expect(errorSpy).toHaveBeenCalledWith('[Intake Experiment Testing] Failed to get active tab:', expect.any(String))
  })

  it('handles multiple tabs in query result and returns first', async () => {
    const tabs = [
      { id: 1, url: 'https://first.com' },
      { id: 2, url: 'https://second.com' },
    ]
    queryMock.mockResolvedValueOnce(tabs)

    await expect(getActiveTab()).resolves.toStrictEqual({ id: 1, url: 'https://first.com' })
  })

  it('handles tab with undefined URL', async () => {
    const tab = { id: 1 }
    queryMock.mockResolvedValueOnce([tab])

    await expect(getActiveTab()).resolves.toStrictEqual({ id: 1 })
  })
})
